import crypto from "node:crypto";
import { resend } from "../config/providers.js";
import { env, isProduction } from "../config/env.js";
import { EmailLog } from "../models/EmailLog.js";
import { EMAIL_MAX_ATTEMPTS } from "../../../shared/domain.js";
import { logError } from "../utils/logger.js";

const workerId = `email-${process.pid}-${crypto.randomUUID()}`;
const retryDelays = [0, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

export const runEmailWorkerOnce = async () => {
  const now = new Date();
  const log = await EmailLog.findOneAndUpdate(
    {
      attempts: { $lt: EMAIL_MAX_ATTEMPTS },
      $or: [
        {
          status: { $in: ["queued", "failed"] },
          nextAttemptAt: { $lte: now },
        },
        {
          status: "processing",
          lockedAt: { $lte: new Date(now.getTime() - 10 * 60 * 1000) },
        },
      ],
    },
    {
      $set: { status: "processing", lockedAt: now, lockedBy: workerId },
      $unset: { errorMessage: 1 },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } }
  ).select("+html");
  if (!log) return false;

  try {
    if (!resend) {
      if (isProduction) throw new Error("Resend is not configured");
      log.providerMessageId = `development-${log.id}`;
      console.info(`[development email] ${log.subject} -> ${log.recipientEmail}`);
    } else {
      const { data, error } = await resend.emails.send({
        from: `${env.emailFromName} <${env.emailFromAddress}>`,
        to: [log.recipientEmail],
        subject: log.subject,
        html: log.html,
      });
      if (error) {
        const deliveryError = new Error(error.message || "Resend rejected the message");
        deliveryError.code = error.name;
        throw deliveryError;
      }
      log.providerMessageId = data?.id;
    }
    log.status = "sent";
    log.sentAt = new Date();
    log.lockedAt = undefined;
    log.lockedBy = undefined;
    await log.save();
  } catch (error) {
    const exhausted = log.attempts >= EMAIL_MAX_ATTEMPTS;
    log.status = exhausted ? "dead_letter" : "failed";
    log.errorMessage = String(error.message || error).slice(0, 1000);
    log.providerStatusCode = error.code;
    log.nextAttemptAt = exhausted
      ? undefined
      : new Date(
          Date.now() +
            retryDelays[Math.min(log.attempts, retryDelays.length - 1)]
        );
    log.lockedAt = undefined;
    log.lockedBy = undefined;
    await log.save();
  }
  return true;
};

export const startEmailWorker = ({ intervalMs = 1000 } = {}) => {
  let stopped = false;
  let timer;
  const tick = async () => {
    if (stopped) return;
    try {
      const worked = await runEmailWorkerOnce();
      timer = setTimeout(tick, worked ? 0 : intervalMs);
    } catch (error) {
      logError("Email worker tick failed", error);
      timer = setTimeout(tick, intervalMs);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
