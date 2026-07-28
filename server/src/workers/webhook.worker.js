import crypto from "node:crypto";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { processWebhookEvent } from "../services/webhook.service.js";
import { WEBHOOK_MAX_ATTEMPTS } from "../../../shared/domain.js";
import { logError } from "../utils/logger.js";

const workerId = `webhook-${process.pid}-${crypto.randomUUID()}`;
const STALE_LOCK_MS = 10 * 60 * 1000;

export const runWebhookWorkerOnce = async () => {
  const now = new Date();
  const log = await WebhookEvent.findOneAndUpdate(
    {
      attempts: { $lt: WEBHOOK_MAX_ATTEMPTS },
      $or: [
        {
          $and: [
            { status: { $in: ["received", "deferred", "failed"] } },
            {
              $or: [
                { nextAttemptAt: { $lte: now } },
                { nextAttemptAt: { $exists: false } },
              ],
            },
          ],
        },
        {
          status: "processing",
          lockedAt: { $lte: new Date(now.getTime() - STALE_LOCK_MS) },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedAt: now,
        lockedBy: workerId,
        lastAttemptAt: now,
      },
      $unset: { errorMessage: 1 },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, receivedAt: 1 } }
  ).select("+payload");
  if (!log) return false;
  await processWebhookEvent(log.payload, log._id, { claimed: true });
  return true;
};

export const startWebhookWorker = ({ intervalMs = 1000 } = {}) => {
  let stopped = false;
  let timer;
  const tick = async () => {
    if (stopped) return;
    try {
      const worked = await runWebhookWorkerOnce();
      timer = setTimeout(tick, worked ? 0 : intervalMs);
    } catch (error) {
      logError("Webhook worker tick failed", error);
      timer = setTimeout(tick, intervalMs);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
