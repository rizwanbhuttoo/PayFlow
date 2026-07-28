import mongoose from "mongoose";
import {
  SUBSCRIPTION_INVOICE_STATUSES,
  SUBSCRIPTION_PAYMENT_STATUSES,
  SUPPORTED_CURRENCIES,
} from "../../../shared/domain.js";

const subscriptionInvoiceSchema = new mongoose.Schema(
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
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
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
    stripeInvoiceId: { type: String, required: true },
    stripeSubscriptionId: { type: String, required: true, index: true },
    stripeCustomerId: { type: String, required: true, index: true },
    stripePaymentIntentId: String,
    stripeChargeId: String,
    invoiceNumber: String,
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0 },
    amountRemaining: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      enum: SUPPORTED_CURRENCIES,
    },
    invoiceStatus: {
      type: String,
      enum: SUBSCRIPTION_INVOICE_STATUSES,
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: SUBSCRIPTION_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    billingReason: String,
    hostedInvoiceUrl: String,
    invoicePdfUrl: String,
    periodStart: Date,
    periodEnd: Date,
    paymentAttemptedAt: Date,
    paidAt: { type: Date, index: true },
    nextPaymentAttempt: Date,
    failureMessage: { type: String, maxlength: 1000 },
    lastSyncedAt: Date,
    lastStripeEventCreatedAt: Date,
  },
  { timestamps: true }
);

subscriptionInvoiceSchema.index(
  { stripeAccountId: 1, stripeInvoiceId: 1 },
  { unique: true }
);
subscriptionInvoiceSchema.index({ user: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ plan: 1, paymentStatus: 1, paidAt: -1 });
subscriptionInvoiceSchema.index({ subscription: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ user: 1, customer: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ user: 1, customer: 1, paidAt: -1 });

export const SubscriptionInvoice = mongoose.model(
  "SubscriptionInvoice",
  subscriptionInvoiceSchema
);
