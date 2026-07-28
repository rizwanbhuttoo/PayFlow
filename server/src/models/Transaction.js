import mongoose from "mongoose";
import {
  SUPPORTED_CURRENCIES,
  TRANSACTION_STATUSES,
} from "../../../shared/domain.js";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentLink: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentLink", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    stripeAccountId: { type: String, required: true, index: true },
    stripeCheckoutSessionId: String,
    stripePaymentIntentId: String,
    stripeChargeId: String,
    stripeCustomerId: String,
    customerName: String,
    customerEmail: { type: String, lowercase: true, trim: true, index: true },
    customerPhone: String,
    amount: { type: Number, required: true },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      enum: SUPPORTED_CURRENCIES,
    },
    platformFee: { type: Number, default: 0 },
    stripeFee: Number,
    netAmount: Number,
    feeStatus: {
      type: String,
      enum: ["pending", "available", "unavailable"],
      default: "pending",
    },
    paymentMethodType: String,
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: "pending",
      index: true,
    },
    paidAt: Date,
    refundedAt: Date,
    refundedAmount: { type: Number, default: 0 },
    failureMessage: String,
    lastStripeEventCreatedAt: Date,
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ user: 1, status: 1, createdAt: -1 });
transactionSchema.index({ user: 1, customer: 1, createdAt: -1 });
transactionSchema.index({ user: 1, customer: 1, paidAt: -1 });
transactionSchema.index({ user: 1, paymentLink: 1, createdAt: -1 });
transactionSchema.index({ user: 1, status: 1, paidAt: -1 });
transactionSchema.index(
  { stripeAccountId: 1, stripePaymentIntentId: 1 },
  { unique: true, sparse: true }
);
transactionSchema.index(
  { stripeAccountId: 1, stripeCheckoutSessionId: 1 },
  { unique: true, sparse: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
