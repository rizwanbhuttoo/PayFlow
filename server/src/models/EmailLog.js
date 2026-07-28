import mongoose from "mongoose";
import {
  EMAIL_DELIVERY_STATUSES,
  SUBSCRIPTION_EMAIL_TYPES,
} from "../../../shared/domain.js";

const emailLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentLink: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentLink", index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    subscriptionPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionInvoice",
      index: true,
    },
    kind: {
      type: String,
      enum: [
        "verification",
        "password_reset",
        "payment_link",
        ...SUBSCRIPTION_EMAIL_TYPES,
      ],
      required: true,
    },
    dedupeKey: { type: String, sparse: true, unique: true },
    recipientName: String,
    recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerEmailSnapshot: { type: String, lowercase: true, trim: true },
    subject: { type: String, required: true },
    message: String,
    html: { type: String, select: false },
    providerMessageId: String,
    providerStatusCode: String,
    status: { type: String, enum: EMAIL_DELIVERY_STATUSES, default: "queued" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedAt: Date,
    lockedBy: String,
    errorMessage: String,
    sentAt: Date,
  },
  { timestamps: true }
);

emailLogSchema.index({ user: 1, createdAt: -1 });
emailLogSchema.index({ subscription: 1, kind: 1, createdAt: -1 });
emailLogSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
emailLogSchema.index({ user: 1, customer: 1, createdAt: -1 });

export const EmailLog = mongoose.model("EmailLog", emailLogSchema);
