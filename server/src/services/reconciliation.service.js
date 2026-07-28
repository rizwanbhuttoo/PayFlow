import mongoose from "mongoose";
import { PaymentLink } from "../models/PaymentLink.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { Transaction } from "../models/Transaction.js";
import {
  retrieveStripeSubscription,
} from "./subscriptionStripe.service.js";
import {
  syncSubscriptionPlanMetrics,
  syncSubscriptionRecord,
} from "./subscriptionWebhook.service.js";
import { logError } from "../utils/logger.js";

const reconcilePaymentLinkMetrics = async (link) => {
  const [summary] = await Transaction.aggregate([
    {
      $match: {
        paymentLink: new mongoose.Types.ObjectId(link._id),
        status: { $in: ["succeeded", "partially_refunded", "refunded"] },
      },
    },
    {
      $group: {
        _id: null,
        paymentCount: { $sum: 1 },
        retainedPaymentCount: {
          $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] },
        },
        refundedPaymentCount: {
          $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] },
        },
        partiallyRefundedPaymentCount: {
          $sum: { $cond: [{ $eq: ["$status", "partially_refunded"] }, 1, 0] },
        },
        totalReceived: {
          $sum: {
            $max: [
              0,
              { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] },
            ],
          },
        },
      },
    },
  ]);
  await PaymentLink.updateOne(
    { _id: link._id },
    {
      $set: {
        paymentCount: summary?.paymentCount || 0,
        retainedPaymentCount: summary?.retainedPaymentCount || 0,
        refundedPaymentCount: summary?.refundedPaymentCount || 0,
        partiallyRefundedPaymentCount:
          summary?.partiallyRefundedPaymentCount || 0,
        totalReceived: summary?.totalReceived || 0,
      },
    }
  );
};

export const reconcileAll = async () => {
  const result = {
    plans: 0,
    paymentLinks: 0,
    subscriptions: 0,
    subscriptionErrors: 0,
  };
  for await (const plan of SubscriptionPlan.find({}).select("_id").cursor()) {
    await syncSubscriptionPlanMetrics(plan._id);
    result.plans += 1;
  }
  for await (const link of PaymentLink.find({}).select("_id").cursor()) {
    await reconcilePaymentLinkMetrics(link);
    result.paymentLinks += 1;
  }
  for await (const subscription of Subscription.find({
    status: { $in: ["incomplete", "active", "past_due", "unpaid"] },
  }).cursor()) {
    try {
      const stripeSubscription = await retrieveStripeSubscription(
        subscription.stripeSubscriptionId,
        subscription.stripeAccountId
      );
      await syncSubscriptionRecord({
        stripeSubscription,
        stripeAccountId: subscription.stripeAccountId,
      });
      result.subscriptions += 1;
    } catch (error) {
      result.subscriptionErrors += 1;
      await Subscription.updateOne(
        { _id: subscription._id },
        {
          $set: {
            syncStatus: "error",
            syncError: String(error.message || error).slice(0, 1000),
          },
        }
      );
      logError(`Subscription ${subscription.id} reconciliation failed`, error);
    }
  }
  return result;
};
