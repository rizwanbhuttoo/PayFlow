import mongoose from "mongoose";
import {
  CUSTOMER_SOURCE_TYPES,
  CUSTOMER_STATUSES,
} from "../../../shared/domain.js";

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeAccountId: { type: String, required: true, index: true },
    name: { type: String, trim: true, maxlength: 200 },
    normalizedName: { type: String, lowercase: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    normalizedEmail: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 50 },
    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      default: "active",
      index: true,
    },
    sourceTypes: [{ type: String, enum: CUSTOMER_SOURCE_TYPES }],
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    lastStripeEventCreatedAt: Date,
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: { virtuals: true },
  }
);

customerSchema.index(
  { user: 1, stripeAccountId: 1, normalizedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedEmail: { $type: "string" },
      status: "active",
    },
  }
);
customerSchema.index({ user: 1, status: 1, lastSeenAt: -1 });
customerSchema.index({ user: 1, normalizedName: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
