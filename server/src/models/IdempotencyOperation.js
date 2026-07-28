import mongoose from "mongoose";
import {
  IDEMPOTENCY_OPERATION_STATUSES,
  IDEMPOTENCY_OPERATION_TYPES,
} from "../../../shared/domain.js";

const idempotencyOperationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      enum: IDEMPOTENCY_OPERATION_TYPES,
      required: true,
    },
    idempotencyKey: { type: String, required: true, maxlength: 200 },
    requestHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: IDEMPOTENCY_OPERATION_STATUSES,
      default: "started",
      index: true,
    },
    localResourceId: mongoose.Schema.Types.ObjectId,
    stripeProductId: String,
    stripePriceId: String,
    stripePaymentLinkId: String,
    stripeCheckoutSessionId: String,
    stripeSubscriptionId: String,
    errorMessage: { type: String, maxlength: 1000 },
    completedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true }
);

idempotencyOperationSchema.index(
  { user: 1, operationType: 1, idempotencyKey: 1 },
  { unique: true }
);
idempotencyOperationSchema.index({ status: 1, updatedAt: 1 });

export const IdempotencyOperation = mongoose.model(
  "IdempotencyOperation",
  idempotencyOperationSchema
);
