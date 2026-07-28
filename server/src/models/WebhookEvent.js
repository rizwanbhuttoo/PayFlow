import mongoose from "mongoose";
import { WEBHOOK_EVENT_STATUSES } from "../../../shared/domain.js";

const webhookEventSchema = new mongoose.Schema(
  {
    stripeEventId: { type: String, required: true, unique: true, index: true },
    stripeAccountId: { type: String, index: true },
    eventType: { type: String, required: true },
    objectId: String,
    payload: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
    apiVersion: String,
    livemode: Boolean,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      index: true,
    },
    status: {
      type: String,
      enum: WEBHOOK_EVENT_STATUSES,
      default: "received",
    },
    attempts: { type: Number, default: 0 },
    errorMessage: String,
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedAt: Date,
    lockedBy: String,
    lastAttemptAt: Date,
    deadLetteredAt: Date,
    receivedAt: { type: Date, default: Date.now },
    processedAt: Date,
  },
  { timestamps: true }
);

webhookEventSchema.index({ status: 1, nextAttemptAt: 1, receivedAt: 1 });
webhookEventSchema.index({ status: 1, lockedAt: 1 });

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
