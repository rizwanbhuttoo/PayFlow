import { PaymentLink } from "../models/PaymentLink.js";
import { expireStripePaymentLink } from "../services/stripe.service.js";
import { logError } from "../utils/logger.js";

const MAX_ATTEMPTS = 5;
const retryDelays = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export const runPaymentLinkExpiryWorkerOnce = async () => {
  const now = new Date();
  const link = await PaymentLink.findOneAndUpdate(
    {
      status: "active",
      expiresAt: { $lte: now },
      expiryAttempts: { $lt: MAX_ATTEMPTS },
      $or: [
        {
          expiryStatus: { $ne: "processing" },
          $or: [
            { expiryNextAttemptAt: { $exists: false } },
            { expiryNextAttemptAt: { $lte: now } },
          ],
        },
        {
          expiryStatus: "processing",
          expiryLockedAt: { $lte: new Date(now.getTime() - 10 * 60 * 1000) },
        },
      ],
    },
    {
      $set: { expiryStatus: "processing", expiryLockedAt: now },
      $inc: { expiryAttempts: 1 },
      $unset: { expiryError: 1 },
    },
    { new: true, sort: { expiresAt: 1 } }
  );
  if (!link) return false;

  try {
    await expireStripePaymentLink(link);
  } catch (error) {
    link.expiryStatus = "failed";
    link.expiryLockedAt = undefined;
    link.expiryError = String(error.message || error).slice(0, 1000);
    link.expiryNextAttemptAt =
      link.expiryAttempts >= MAX_ATTEMPTS
        ? undefined
        : new Date(
            Date.now() +
              retryDelays[Math.min(link.expiryAttempts, retryDelays.length - 1)]
          );
    await link.save();
    logError(`Payment link ${link.id} expiry failed`, error);
  }
  return true;
};

export const startPaymentLinkExpiryWorker = ({ intervalMs = 30_000 } = {}) => {
  let stopped = false;
  let timer;
  const tick = async () => {
    if (stopped) return;
    try {
      const worked = await runPaymentLinkExpiryWorkerOnce();
      timer = setTimeout(tick, worked ? 0 : intervalMs);
    } catch (error) {
      logError("Payment-link expiry worker tick failed", error);
      timer = setTimeout(tick, intervalMs);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
