import mongoose from "mongoose";
import {
  PAYMENT_LINK_STATUSES,
  SUPPORTED_CURRENCIES,
} from "../../../shared/domain.js";

const paymentLinkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    stripeAccountId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    amount: { type: Number, required: true, min: 1 },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      enum: SUPPORTED_CURRENCIES,
    },
    internalReference: { type: String, trim: true, maxlength: 100 },
    intendedRecipientEmail: { type: String, lowercase: true, trim: true },
    redirectUrl: String,
    stripeProductId: { type: String, required: true },
    stripePriceId: { type: String, required: true },
    stripePaymentLinkId: String,
    stripeCheckoutSessionId: String,
    checkoutType: {
      type: String,
      enum: ["customer_session", "legacy_payment_link"],
    },
    publicUrl: { type: String, required: true },
    status: {
      type: String,
      enum: PAYMENT_LINK_STATUSES,
      default: "active",
      index: true,
    },
    paymentCount: { type: Number, default: 0 },
    retainedPaymentCount: { type: Number, default: 0 },
    refundedPaymentCount: { type: Number, default: 0 },
    partiallyRefundedPaymentCount: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    expiresAt: Date,
    expiryStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
    },
    expiryAttempts: { type: Number, default: 0 },
    expiryNextAttemptAt: Date,
    expiryLockedAt: Date,
    expiryError: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

paymentLinkSchema.index({ user: 1, createdAt: -1 });
paymentLinkSchema.index({ user: 1, status: 1, createdAt: -1 });
paymentLinkSchema.index({ user: 1, customer: 1, createdAt: -1 });
paymentLinkSchema.index(
  { stripeAccountId: 1, stripePaymentLinkId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripePaymentLinkId: { $type: "string" } },
  }
);
paymentLinkSchema.index(
  { stripeAccountId: 1, stripeCheckoutSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripeCheckoutSessionId: { $type: "string" } },
  }
);
paymentLinkSchema.index({ status: 1, expiresAt: 1, expiryNextAttemptAt: 1, expiryLockedAt: 1 });

export const PaymentLink = mongoose.model("PaymentLink", paymentLinkSchema);
