import mongoose from "mongoose";
import { ONBOARDING_STATUSES } from "../../../shared/domain.js";

const stripeAccountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    stripeAccountId: { type: String, required: true, unique: true, index: true },
    onboardingStatus: {
      type: String,
      enum: ONBOARDING_STATUSES,
      default: "not_started",
    },
    detailsSubmitted: { type: Boolean, default: false },
    chargesEnabled: { type: Boolean, default: false },
    payoutsEnabled: { type: Boolean, default: false },
    country: String,
    defaultCurrency: String,
    connectedAt: Date,
  },
  { timestamps: true }
);

export const StripeAccount = mongoose.model("StripeAccount", stripeAccountSchema);
