import mongoose from "mongoose";
import {
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_STATUSES,
  SUPPORTED_CURRENCIES,
} from "../../../shared/domain.js";

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    stripeAccountId: { type: String, required: true, index: true },
    stripeCustomerId: { type: String, required: true, index: true },
    stripeSubscriptionId: { type: String, required: true },
    stripeProductId: { type: String, required: true },
    stripePriceId: { type: String, required: true },
    customerName: { type: String, trim: true, maxlength: 200 },
    customerEmail: { type: String, lowercase: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      enum: SUPPORTED_CURRENCIES,
    },
    billingInterval: {
      type: String,
      required: true,
      enum: SUBSCRIPTION_BILLING_INTERVALS,
      index: true,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "incomplete",
      index: true,
    },
    cancelAtPeriodEnd: { type: Boolean, default: false, index: true },
    currentPeriodStart: Date,
    currentPeriodEnd: { type: Date, index: true },
    trialStart: Date,
    trialEnd: Date,
    canceledAt: Date,
    endedAt: Date,
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    latestStripeInvoiceId: String,
    latestStripePaymentIntentId: String,
    lastSyncedAt: Date,
    lastStripeEventCreatedAt: Date,
    syncStatus: { type: String, enum: ["synced", "error"], default: "synced" },
    syncError: String,
  },
  { timestamps: true }
);

subscriptionSchema.index(
  { stripeAccountId: 1, stripeSubscriptionId: 1 },
  { unique: true }
);
subscriptionSchema.index({ user: 1, createdAt: -1 });
subscriptionSchema.index({ user: 1, status: 1, createdAt: -1 });
subscriptionSchema.index({ plan: 1, status: 1, createdAt: -1 });
subscriptionSchema.index({ user: 1, cancelAtPeriodEnd: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ user: 1, status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ user: 1, customer: 1, createdAt: -1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
