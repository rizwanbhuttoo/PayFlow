import mongoose from "mongoose";
import {
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_STATUSES,
  SUPPORTED_CURRENCIES,
} from "../../../shared/domain.js";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeAccountId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
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
    internalReference: { type: String, trim: true, maxlength: 100 },
    successMessage: { type: String, trim: true, maxlength: 500 },
    redirectUrl: String,
    stripeProductId: { type: String, required: true },
    stripePriceId: { type: String, required: true },
    stripePaymentLinkId: String,
    publicUrl: String,
    status: {
      type: String,
      enum: SUBSCRIPTION_PLAN_STATUSES,
      default: "active",
      index: true,
    },
    totalSubscribers: { type: Number, default: 0, min: 0 },
    activeSubscriberCount: { type: Number, default: 0, min: 0 },
    totalRecurringRevenue: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index(
  { stripeAccountId: 1, stripeProductId: 1 },
  { unique: true }
);
subscriptionPlanSchema.index(
  { stripeAccountId: 1, stripePriceId: 1 },
  { unique: true }
);
subscriptionPlanSchema.index(
  { stripeAccountId: 1, stripePaymentLinkId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripePaymentLinkId: { $type: "string" } },
  }
);
subscriptionPlanSchema.index({ user: 1, createdAt: -1 });
subscriptionPlanSchema.index({ user: 1, status: 1, createdAt: -1 });
subscriptionPlanSchema.index({ user: 1, billingInterval: 1, createdAt: -1 });

export const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);
