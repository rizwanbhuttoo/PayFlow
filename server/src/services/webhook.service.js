import mongoose from "mongoose";
import { PaymentLink } from "../models/PaymentLink.js";
import { StripeAccount } from "../models/StripeAccount.js";
import { Transaction } from "../models/Transaction.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { syncStripeAccount } from "./stripe.service.js";
import { logError } from "../utils/logger.js";
import { WEBHOOK_MAX_ATTEMPTS } from "../../../shared/domain.js";
import {
  handleSubscriptionCheckoutCompleted,
  handleSubscriptionInvoiceEvent,
  handleSubscriptionLifecycleEvent,
} from "./subscriptionWebhook.service.js";
import { resolveCustomer } from "./customer.service.js";
import { stripe } from "../config/providers.js";

const idOf = (value) => (typeof value === "string" ? value : value?.id);

const allowedTransitions = {
  pending: new Set(["pending", "failed", "succeeded"]),
  failed: new Set(["failed", "succeeded"]),
  succeeded: new Set(["succeeded"]),
  partially_refunded: new Set(["partially_refunded", "refunded"]),
  refunded: new Set(["refunded"]),
};

export const shouldApplyTransactionStatus = (currentStatus, targetStatus) =>
  !currentStatus || Boolean(allowedTransitions[currentStatus]?.has(targetStatus));

export const getRefundStatus = (amount, refundedAmount) =>
  refundedAmount >= amount ? "refunded" : "partially_refunded";

export const isWebhookRetryEligible = ({ status, attempts }) =>
  ["received", "deferred", "failed"].includes(status) &&
  attempts < WEBHOOK_MAX_ATTEMPTS;

const syncPaymentLinkTotals = async (paymentLinkId) => {
  const [summary] = await Transaction.aggregate([
    {
      $match: {
        paymentLink: new mongoose.Types.ObjectId(paymentLinkId),
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
              {
                $subtract: [
                  "$amount",
                  { $ifNull: ["$refundedAmount", 0] },
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  await PaymentLink.updateOne(
    { _id: paymentLinkId },
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

const resolvePaymentLink = async (object) => {
  const mongoId = object.metadata?.appPaymentLinkId;
  if (mongoId && mongoose.isValidObjectId(mongoId)) {
    const byId = await PaymentLink.findById(mongoId);
    if (byId) return byId;
  }
  const stripePaymentLinkId = idOf(object.payment_link);
  return stripePaymentLinkId
    ? PaymentLink.findOne({ stripePaymentLinkId })
    : null;
};

const transitionTransaction = async ({
  object,
  eventAccount,
  targetStatus,
  eventCreatedAt,
}) => {
  const paymentIntentId =
    object.object === "payment_intent" ? object.id : idOf(object.payment_intent);
  const sessionId = object.object === "checkout.session" ? object.id : undefined;
  const lookup = paymentIntentId
    ? {
        stripePaymentIntentId: paymentIntentId,
        ...(eventAccount ? { stripeAccountId: eventAccount } : {}),
      }
    : {
        stripeCheckoutSessionId: sessionId,
        ...(eventAccount ? { stripeAccountId: eventAccount } : {}),
      };
  let transaction = await Transaction.findOne(lookup);
  const link = transaction
    ? await PaymentLink.findById(transaction.paymentLink)
    : await resolvePaymentLink(object);
  if (!link) return null;
  if (eventAccount && link.stripeAccountId !== eventAccount) {
    throw new Error(`Connected account mismatch for ${object.id}`);
  }
  const staleDetails =
    eventCreatedAt &&
    transaction?.lastStripeEventCreatedAt &&
    transaction.lastStripeEventCreatedAt > eventCreatedAt;
  const effectiveStatus = shouldApplyTransactionStatus(transaction?.status, targetStatus)
    ? targetStatus
    : transaction.status;

  const customerDetails = object.customer_details || object.billing_details || {};
  const stripeCustomerId = idOf(object.customer);
  const customer = await resolveCustomer({
    user: link.user,
    stripeAccountId: eventAccount || link.stripeAccountId,
    stripeCustomerId,
    name: customerDetails.name,
    email:
      customerDetails.email ||
      object.receipt_email ||
      object.customer_email,
    phone: customerDetails.phone,
    source: "one_time",
    seenAt: eventCreatedAt || new Date(),
    stripeEventCreatedAt: eventCreatedAt,
  });
  const amount =
    object.amount_total ??
    object.amount_received ??
    object.amount ??
    link.amount;
  const update = {
    user: link.user,
    paymentLink: link.id,
    stripeAccountId: eventAccount || link.stripeAccountId,
    ...(sessionId ? { stripeCheckoutSessionId: sessionId } : {}),
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    stripeChargeId:
      (object.object === "charge" ? object.id : idOf(object.latest_charge)) ||
      transaction?.stripeChargeId,
    ...(!staleDetails
      ? {
          customer: customer?._id || transaction?.customer,
          stripeCustomerId: stripeCustomerId || transaction?.stripeCustomerId,
          customerName: customerDetails.name || transaction?.customerName,
          customerEmail:
            customerDetails.email ||
            object.receipt_email ||
            object.customer_email ||
            transaction?.customerEmail,
          customerPhone: customerDetails.phone || transaction?.customerPhone,
          ...(eventCreatedAt ? { lastStripeEventCreatedAt: eventCreatedAt } : {}),
        }
      : {}),
    amount,
    currency: object.currency || link.currency,
    platformFee: object.application_fee_amount || transaction?.platformFee || 0,
    feeStatus:
      Number.isFinite(object.balance_transaction?.fee) ||
      Number.isFinite(object.balance_transaction?.net)
        ? "available"
        : "unavailable",
    ...(Number.isFinite(object.balance_transaction?.fee)
      ? { stripeFee: object.balance_transaction.fee }
      : {}),
    ...(Number.isFinite(object.balance_transaction?.net)
      ? { netAmount: object.balance_transaction.net }
      : {}),
    paymentMethodType:
      object.payment_method_types?.[0] ||
      object.payment_method_details?.type ||
      transaction?.paymentMethodType,
    status: effectiveStatus,
    ...(effectiveStatus === "succeeded" && !transaction?.paidAt
      ? { paidAt: new Date((object.created || Date.now() / 1000) * 1000) }
      : {}),
    ...(effectiveStatus === "failed"
      ? { failureMessage: object.last_payment_error?.message || "Payment failed" }
      : {}),
  };

  if (transaction) {
    Object.assign(transaction, update);
    await transaction.save();
  } else {
    transaction = await Transaction.create(update);
  }

  await syncPaymentLinkTotals(link.id);
  if (
    effectiveStatus === "succeeded" &&
    Boolean(link.stripeCheckoutSessionId) &&
    link.status === "active"
  ) {
    await PaymentLink.updateOne(
      { _id: link._id, status: "active" },
      { $set: { status: "completed" } }
    );
  }
  return transaction;
};

const handleRefund = async (charge, eventAccount) => {
  const transaction = await Transaction.findOne({
    ...(eventAccount ? { stripeAccountId: eventAccount } : {}),
    $or: [
      { stripeChargeId: charge.id },
      ...(idOf(charge.payment_intent)
        ? [{ stripePaymentIntentId: idOf(charge.payment_intent) }]
        : []),
    ],
  });
  if (!transaction) return null;
  if (eventAccount && transaction.stripeAccountId !== eventAccount) {
    throw new Error(`Connected account mismatch for refund ${charge.id}`);
  }

  const refundedAmount = charge.amount_refunded || 0;
  transaction.stripeChargeId = charge.id;
  transaction.refundedAmount = refundedAmount;
  transaction.refundedAt = new Date();
  transaction.status = getRefundStatus(charge.amount, refundedAmount);
  await transaction.save();
  await syncPaymentLinkTotals(transaction.paymentLink);
  return transaction;
};

const retryDelays = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

const deferOrDeadLetter = async (log, errorMessage, status = "failed") => {
  const exhausted = log.attempts >= WEBHOOK_MAX_ATTEMPTS;
  log.status = exhausted ? "dead_letter" : status;
  log.errorMessage = String(errorMessage).slice(0, 1000);
  log.nextAttemptAt = exhausted
    ? undefined
    : new Date(Date.now() + retryDelays[Math.min(log.attempts, retryDelays.length - 1)]);
  log.deadLetteredAt = exhausted ? new Date() : undefined;
  log.lockedAt = undefined;
  log.lockedBy = undefined;
  await log.save();
};

export const processWebhookEvent = async (event, logId, { claimed = false } = {}) => {
  const log = claimed
    ? await WebhookEvent.findById(logId).select("+payload")
    : await WebhookEvent.findOneAndUpdate(
        {
          _id: logId,
          status: { $in: ["received", "deferred", "failed"] },
          attempts: { $lt: WEBHOOK_MAX_ATTEMPTS },
          nextAttemptAt: { $lte: new Date() },
        },
        {
          $set: {
            status: "processing",
            lockedAt: new Date(),
            lastAttemptAt: new Date(),
          },
          $unset: { errorMessage: 1 },
          $inc: { attempts: 1 },
        },
        { new: true }
      );
  if (!log) return;

  try {
    const object = event.data.object;
    const eventCreatedAt = Number.isFinite(event.created)
      ? new Date(event.created * 1000)
      : undefined;
    let relatedRecord;
    let handled = true;
    let retryWhenUnresolved = false;
    switch (event.type) {
      case "checkout.session.completed": {
        retryWhenUnresolved = true;
        if (object.mode === "subscription") {
          relatedRecord = await handleSubscriptionCheckoutCompleted(
            object,
            event.account,
            eventCreatedAt
          );
          handled = Boolean(relatedRecord);
        } else {
          relatedRecord = await transitionTransaction({
            object,
            eventAccount: event.account,
            eventCreatedAt,
            targetStatus:
              object.payment_status === "paid" ? "succeeded" : "pending",
          });
          handled = Boolean(relatedRecord);
        }
        break;
      }
      case "payment_intent.succeeded":
        if (object.invoice || object.metadata?.appSubscriptionPlanId) {
          handled = false;
        } else {
          retryWhenUnresolved = true;
          relatedRecord = await transitionTransaction({
            object,
            eventAccount: event.account,
            eventCreatedAt,
            targetStatus: "succeeded",
          });
          handled = Boolean(relatedRecord);
        }
        break;
      case "payment_intent.payment_failed":
        if (object.invoice || object.metadata?.appSubscriptionPlanId) {
          handled = false;
        } else {
          retryWhenUnresolved = true;
          relatedRecord = await transitionTransaction({
            object,
            eventAccount: event.account,
            eventCreatedAt,
            targetStatus: "failed",
          });
          handled = Boolean(relatedRecord);
        }
        break;
      case "charge.refunded":
        if (object.invoice || object.metadata?.appSubscriptionPlanId) {
          handled = false;
        } else {
          retryWhenUnresolved = true;
          relatedRecord = await handleRefund(object, event.account);
          handled = Boolean(relatedRecord);
        }
        break;
      case "charge.succeeded":
        if (object.invoice || object.metadata?.appSubscriptionPlanId) {
          handled = false;
        } else {
          retryWhenUnresolved = true;
          const charge =
            typeof object.balance_transaction === "object"
              ? object
              : await stripe.charges.retrieve(
                  object.id,
                  { expand: ["balance_transaction"] },
                  { stripeAccount: event.account }
                );
          relatedRecord = await transitionTransaction({
            object: charge,
            eventAccount: event.account,
            eventCreatedAt,
            targetStatus: "succeeded",
          });
          handled = Boolean(relatedRecord);
        }
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        retryWhenUnresolved = true;
        relatedRecord = await handleSubscriptionLifecycleEvent(
          object,
          event.account,
          event.type,
          eventCreatedAt
        );
        handled = Boolean(relatedRecord);
        break;
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        retryWhenUnresolved = true;
        relatedRecord = await handleSubscriptionInvoiceEvent(
          object,
          event.account,
          event.type,
          eventCreatedAt
        );
        handled = Boolean(relatedRecord);
        break;
      case "account.updated": {
        const existing = await StripeAccount.findOne({ stripeAccountId: object.id });
        if (existing) {
          await syncStripeAccount(object);
        } else {
          handled = false;
        }
        break;
      }
      default:
        handled = false;
        break;
    }
    const subscription = relatedRecord?.subscription;
    if (subscription) {
      log.user = subscription.user;
      log.subscription = subscription._id;
    } else if (relatedRecord?.user) {
      log.user = relatedRecord.user;
    }
    if (!handled && retryWhenUnresolved) {
      await deferOrDeadLetter(
        log,
        "Related PayFlow record is not available yet",
        "deferred"
      );
      return;
    }
    log.status = handled ? "processed" : "ignored";
    log.processedAt = new Date();
    log.lockedAt = undefined;
    log.lockedBy = undefined;
    await log.save();
  } catch (error) {
    await deferOrDeadLetter(log, error.message || error);
    logError(`Webhook ${event.id} failed`, error);
  }
};
