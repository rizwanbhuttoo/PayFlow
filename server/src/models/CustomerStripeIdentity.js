import mongoose from "mongoose";
import { CUSTOMER_STRIPE_IDENTITY_SOURCES } from "../../../shared/domain.js";

const customerStripeIdentitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    stripeAccountId: { type: String, required: true },
    stripeCustomerId: { type: String, required: true },
    source: {
      type: String,
      enum: CUSTOMER_STRIPE_IDENTITY_SOURCES,
      required: true,
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, optimisticConcurrency: true }
);

customerStripeIdentitySchema.index(
  { stripeAccountId: 1, stripeCustomerId: 1 },
  { unique: true }
);
customerStripeIdentitySchema.index({ user: 1, customer: 1, lastSeenAt: -1 });

export const CustomerStripeIdentity = mongoose.model(
  "CustomerStripeIdentity",
  customerStripeIdentitySchema
);
