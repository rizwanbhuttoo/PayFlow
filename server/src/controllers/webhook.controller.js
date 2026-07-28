import { stripe } from "../config/providers.js";
import { env } from "../config/env.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { AppError } from "../utils/AppError.js";

export const receiveStripeWebhook = async (req, res) => {
  if (!stripe || !env.stripeWebhookSecret) {
    throw new AppError("Stripe webhooks are not configured", 503, "STRIPE_NOT_CONFIGURED");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.stripeWebhookSecret
    );
  } catch {
    throw new AppError("Invalid Stripe webhook signature", 400, "INVALID_WEBHOOK_SIGNATURE");
  }

  let log = await WebhookEvent.findOne({ stripeEventId: event.id }).select("+payload");
  if (!log) {
    try {
      log = await WebhookEvent.create({
        stripeEventId: event.id,
        stripeAccountId: event.account,
        eventType: event.type,
        objectId: event.data.object?.id,
        payload: {
          id: event.id,
          type: event.type,
          account: event.account,
          api_version: event.api_version,
          livemode: event.livemode,
          created: event.created,
          data: { object: event.data.object },
        },
        apiVersion: event.api_version,
        livemode: event.livemode,
        status: "received",
        nextAttemptAt: new Date(),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      log = await WebhookEvent.findOne({ stripeEventId: event.id });
    }
  }

  if (!log) {
    throw new AppError("Webhook event could not be recorded", 500, "WEBHOOK_LOG_FAILED");
  }
  if (!log.payload && ["received", "failed", "deferred"].includes(log.status)) {
    log.payload = {
      id: event.id,
      type: event.type,
      account: event.account,
      api_version: event.api_version,
      livemode: event.livemode,
      created: event.created,
      data: { object: event.data.object },
    };
    log.nextAttemptAt = new Date();
    await log.save();
  }

  res.status(200).json({ success: true, data: { received: true } });
};
