import mongoose from "mongoose";

const customerManagementTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
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
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },
    stripeAccountId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    revokedAt: Date,
  },
  { timestamps: true }
);

customerManagementTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
customerManagementTokenSchema.index({ subscription: 1, revokedAt: 1, expiresAt: 1 });

export const CustomerManagementToken = mongoose.model(
  "CustomerManagementToken",
  customerManagementTokenSchema
);
