import mongoose from "mongoose";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { User } from "../models/User.js";
import {
  retrieveStripeCustomer,
  retrieveStripeInvoice,
  retrieveStripeSubscription,
} from "./subscriptionStripe.service.js";
import {
  sendCustomerManagementEmail,
  sendSubscriptionLifecycleEmail,
} from "./email.service.js";
import { logError } from "../utils/logger.js";
import { resolveCustomer } from "./customer.service.js";
import { issueCustomerManagementToken } from "./customerManagementToken.service.js";

const idOf = (value) => (typeof value === "string" ? value : value?.id);
const asDate = (seconds) =>
  Number.isFinite(seconds) ? new Date(seconds * 1000) : undefined;

export const isCompletedSubscriptionCheckout = (session) =>
  session?.mode === "subscription" &&
  session.status === "complete" &&
  Boolean(idOf(session.subscription));

const statusMap = {
  incomplete: "incomplete",
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "unpaid",
  paused: "unpaid",
  canceled: "canceled",
  incomplete_expired: "incomplete_expired",
};

export const mapStripeSubscriptionStatus = (status) =>
  statusMap[status] || "incomplete";

export const deriveLocalSubscriptionStatus = (stripeSubscription) => {
  const mapped = mapStripeSubscriptionStatus(stripeSubscription.status);
  const latestInvoice =
    typeof stripeSubscription.latest_invoice === "object"
      ? stripeSubscription.latest_invoice
      : null;
  const unpaidFirstInvoice =
    mapped === "active" &&
    latestInvoice?.billing_reason === "subscription_create" &&
    !latestInvoice.paid &&
    latestInvoice.status !== "paid";
  return unpaidFirstInvoice ? "incomplete" : mapped;
};

export const getStripeSubscriptionPeriod = (stripeSubscription) => {
  const item = stripeSubscription.items?.data?.[0];
  return {
    start: asDate(
      stripeSubscription.current_period_start ?? item?.current_period_start
    ),
    end: asDate(
      stripeSubscription.current_period_end ?? item?.current_period_end
    ),
  };
};

export const getInvoiceSubscriptionId = (invoice) =>
  idOf(invoice.subscription) ||
  idOf(invoice.parent?.subscription_details?.subscription) ||
  idOf(
    invoice.lines?.data?.find(
      (line) => line.parent?.subscription_item_details?.subscription
    )?.parent?.subscription_item_details?.subscription
  );

export const getInvoicePaymentIntentId = (invoice) =>
  idOf(invoice.payment_intent) ||
  idOf(
    invoice.payments?.data?.find(
      (payment) => payment.payment?.payment_intent
    )?.payment?.payment_intent
  );

export const mapInvoicePaymentStatus = (invoice, eventType = "") => {
  if (invoice.paid || invoice.status === "paid" || eventType === "invoice.paid") {
    return "succeeded";
  }
  const paymentIntent = invoice.payments?.data
    ?.map((payment) => payment.payment?.payment_intent)
    .find((value) => typeof value === "object");
  if (
    eventType === "invoice.payment_action_required" ||
    paymentIntent?.status === "requires_action"
  ) {
    return "action_required";
  }
  if (
    eventType === "invoice.payment_failed" ||
    invoice.status === "uncollectible" ||
    ["requires_payment_method", "canceled"].includes(paymentIntent?.status) ||
    (invoice.status === "open" &&
      invoice.attempted &&
      invoice.attempt_count > 0 &&
      invoice.amount_remaining > 0)
  ) {
    return "failed";
  }
  return "pending";
};

const findPlanForStripeSubscription = async (
  stripeSubscription,
  stripeAccountId
) => {
  const metadataPlanId = stripeSubscription.metadata?.appSubscriptionPlanId;
  if (metadataPlanId && mongoose.isValidObjectId(metadataPlanId)) {
    const plan = await SubscriptionPlan.findOne({
      _id: metadataPlanId,
      stripeAccountId,
    });
    if (plan) return plan;
  }

  const item = stripeSubscription.items?.data?.[0];
  const priceId = idOf(item?.price);
  return priceId
    ? SubscriptionPlan.findOne({ stripeAccountId, stripePriceId: priceId })
    : null;
};

const resolveSubscriptionCustomer = async ({
  plan,
  stripeCustomer,
  fallbackDetails = {},
  eventCreatedAt,
}) => {
  const stripeCustomerId = idOf(stripeCustomer);
  if (!stripeCustomerId) {
    throw new Error("Stripe subscription customer could not be resolved");
  }

  let customerObject =
    typeof stripeCustomer === "object" && !stripeCustomer.deleted
      ? stripeCustomer
      : null;
  if (!customerObject) {
    customerObject = await retrieveStripeCustomer(
      stripeCustomerId,
      plan.stripeAccountId
    );
  }

  const name = fallbackDetails.name || customerObject?.name || undefined;
  const email =
    fallbackDetails.email || customerObject?.email || undefined;
  const phone = fallbackDetails.phone || customerObject?.phone || undefined;

  return resolveCustomer({
    user: plan.user,
    stripeAccountId: plan.stripeAccountId,
    stripeCustomerId,
    name,
    email,
    phone,
    source: "subscription",
    seenAt: eventCreatedAt || new Date(),
    stripeEventCreatedAt: eventCreatedAt,
  });
};

export const syncSubscriptionPlanMetrics = async (planId) => {
  const objectId = new mongoose.Types.ObjectId(planId);
  const [totalSubscribers, activeSubscriberCount, revenue] = await Promise.all([
    Subscription.countDocuments({ plan: objectId }),
    Subscription.countDocuments({ plan: objectId, status: "active" }),
    SubscriptionInvoice.aggregate([
      {
        $match: {
          plan: objectId,
          invoiceStatus: "paid",
          paymentStatus: "succeeded",
        },
      },
      {
        $group: {
          _id: null,
          totalRecurringRevenue: { $sum: "$amountPaid" },
        },
      },
    ]),
  ]);

  await SubscriptionPlan.updateOne(
    { _id: objectId },
    {
      $set: {
        totalSubscribers,
        activeSubscriberCount,
        totalRecurringRevenue: revenue[0]?.totalRecurringRevenue || 0,
      },
    }
  );
};

export const syncSubscriptionRecord = async ({
  stripeSubscription,
  stripeAccountId,
  customerDetails,
  eventCreatedAt,
}) => {
  if (!stripeAccountId) return null;
  const plan = await findPlanForStripeSubscription(
    stripeSubscription,
    stripeAccountId
  );
  if (!plan) return null;

  const item = stripeSubscription.items?.data?.[0];
  const stripeCustomer = stripeSubscription.customer;
  const customer = await resolveSubscriptionCustomer({
    plan,
    stripeCustomer,
    fallbackDetails: customerDetails,
    eventCreatedAt,
  });
  const stripeSubscriptionId = stripeSubscription.id;
  const previous = await Subscription.findOne({
    user: plan.user,
    stripeAccountId,
    stripeSubscriptionId,
  }).lean();
  if (
    eventCreatedAt &&
    previous?.lastStripeEventCreatedAt &&
    previous.lastStripeEventCreatedAt > eventCreatedAt
  ) {
    return {
      subscription: await Subscription.findById(previous._id),
      plan,
      customer,
      stale: true,
    };
  }
  const period = getStripeSubscriptionPeriod(stripeSubscription);
  const latestInvoice =
    typeof stripeSubscription.latest_invoice === "object"
      ? stripeSubscription.latest_invoice
      : null;
  const latestInvoiceId = idOf(stripeSubscription.latest_invoice);
  const latestPaymentIntentId = latestInvoice
    ? getInvoicePaymentIntentId(latestInvoice)
    : undefined;
  const status = deriveLocalSubscriptionStatus(stripeSubscription);
  const trialStart = asDate(stripeSubscription.trial_start);
  const trialEnd = asDate(stripeSubscription.trial_end);
  const canceledAt = asDate(stripeSubscription.canceled_at);
  const endedAt = asDate(stripeSubscription.ended_at);

  const subscription = await Subscription.findOneAndUpdate(
    { user: plan.user, stripeAccountId, stripeSubscriptionId },
    {
      $set: {
        user: plan.user,
        plan: plan._id,
        customer: customer._id,
        stripeCustomerId: idOf(stripeCustomer),
        stripeProductId: idOf(item?.price?.product) || plan.stripeProductId,
        stripePriceId: idOf(item?.price) || plan.stripePriceId,
        customerName: customer.name,
        customerEmail: customer.email,
        amount: item?.price?.unit_amount ?? plan.amount,
        currency: item?.price?.currency || plan.currency,
        billingInterval: plan.billingInterval,
        status,
        cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        ...(trialStart ? { trialStart } : {}),
        ...(trialEnd ? { trialEnd } : {}),
        ...(canceledAt ? { canceledAt } : {}),
        ...(endedAt ? { endedAt } : {}),
        latestStripeInvoiceId: latestInvoiceId,
        latestStripePaymentIntentId:
          latestPaymentIntentId || previous?.latestStripePaymentIntentId,
        lastSyncedAt: new Date(),
        ...(eventCreatedAt ? { lastStripeEventCreatedAt: eventCreatedAt } : {}),
        syncStatus: "synced",
      },
      $setOnInsert: {
        stripeAccountId,
        stripeSubscriptionId,
      },
      $unset: {
        ...(!trialStart ? { trialStart: 1 } : {}),
        ...(!trialEnd ? { trialEnd: 1 } : {}),
        ...(!canceledAt ? { canceledAt: 1 } : {}),
        ...(!endedAt ? { endedAt: 1 } : {}),
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  const activeDelta =
    Number(status === "active") - Number(previous?.status === "active");
  await SubscriptionPlan.updateOne(
    { _id: plan._id },
    {
      $inc: {
        totalSubscribers: previous ? 0 : 1,
        activeSubscriberCount: activeDelta,
      },
    }
  );

  const shouldSendStarted =
    status === "active" && previous?.status !== "active";
  const shouldSendCanceled =
    status === "canceled" && previous?.status !== "canceled";
  if (shouldSendStarted || shouldSendCanceled) {
    const user = await User.findById(plan.user).lean();
    if (user) {
      try {
        await sendSubscriptionLifecycleEmail({
          user,
          plan,
          subscription,
          kind: shouldSendStarted
            ? "subscription_started"
            : "subscription_canceled",
        });
        if (shouldSendStarted) {
          const token = await issueCustomerManagementToken({
            user: plan.user,
            customer: subscription.customer,
            subscription: subscription._id,
            stripeAccountId,
          });
          await sendCustomerManagementEmail({
            user,
            plan,
            subscription,
            token,
          });
        }
      } catch (error) {
        logError("Subscription lifecycle email failed", error);
      }
    }
  }

  return { subscription, plan, customer };
};

const normalizedInvoiceStatus = (status) =>
  ["draft", "open", "paid", "uncollectible", "void"].includes(status)
    ? status
    : "open";

export const syncSubscriptionInvoiceRecord = async ({
  stripeInvoice,
  stripeAccountId,
  eventType,
  eventCreatedAt,
}) => {
  if (!stripeAccountId) return null;
  const stripeSubscriptionId = getInvoiceSubscriptionId(stripeInvoice);
  if (!stripeSubscriptionId) return null;

  const latestStripeSubscription =
    typeof stripeInvoice.subscription === "object"
      ? stripeInvoice.subscription
      : await retrieveStripeSubscription(
          stripeSubscriptionId,
          stripeAccountId
        );
  const synced = await syncSubscriptionRecord({
    stripeSubscription: latestStripeSubscription,
    stripeAccountId,
    eventCreatedAt,
  });
  const subscription = synced?.subscription;
  if (!subscription) return null;

  const paymentStatus = mapInvoicePaymentStatus(stripeInvoice, eventType);
  const stripePaymentIntentId = getInvoicePaymentIntentId(stripeInvoice);
  const invoicePayment = stripeInvoice.payments?.data?.find(
    (payment) => payment.payment
  );
  const stripeChargeId =
    idOf(stripeInvoice.charge) ||
    idOf(stripeInvoice.payment_intent?.latest_charge) ||
    idOf(invoicePayment?.payment?.charge) ||
    idOf(invoicePayment?.payment?.payment_intent?.latest_charge);
  const failureMessage =
    stripeInvoice.last_payment_error?.message ||
    stripeInvoice.last_finalization_error?.message ||
    (paymentStatus === "failed" ? "Recurring payment failed" : undefined);
  const paidAt = asDate(stripeInvoice.status_transitions?.paid_at);
  const nextPaymentAttempt = asDate(stripeInvoice.next_payment_attempt);

  const previousInvoice = await SubscriptionInvoice.findOne({
    stripeAccountId,
    stripeInvoiceId: stripeInvoice.id,
  }).lean();
  if (
    eventCreatedAt &&
    previousInvoice?.lastStripeEventCreatedAt &&
    previousInvoice.lastStripeEventCreatedAt > eventCreatedAt
  ) {
    return {
      invoice: await SubscriptionInvoice.findById(previousInvoice._id),
      subscription,
      stale: true,
    };
  }

  const invoice = await SubscriptionInvoice.findOneAndUpdate(
    {
      stripeAccountId,
      stripeInvoiceId: stripeInvoice.id,
    },
    {
      $set: {
        user: subscription.user,
        plan: subscription.plan,
        subscription: subscription._id,
        customer: subscription.customer,
        stripeSubscriptionId,
        stripeCustomerId:
          idOf(stripeInvoice.customer) || subscription.stripeCustomerId,
        stripePaymentIntentId,
        stripeChargeId,
        invoiceNumber: stripeInvoice.number || undefined,
        amountDue: stripeInvoice.amount_due || 0,
        amountPaid: stripeInvoice.amount_paid || 0,
        amountRemaining: stripeInvoice.amount_remaining || 0,
        currency: stripeInvoice.currency || subscription.currency,
        invoiceStatus: normalizedInvoiceStatus(stripeInvoice.status),
        paymentStatus,
        billingReason: stripeInvoice.billing_reason || undefined,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
        invoicePdfUrl: stripeInvoice.invoice_pdf || undefined,
        periodStart: asDate(stripeInvoice.period_start),
        periodEnd: asDate(stripeInvoice.period_end),
        paymentAttemptedAt:
          stripeInvoice.attempted && stripeInvoice.created
            ? asDate(stripeInvoice.created)
            : undefined,
        paidAt,
        ...(nextPaymentAttempt ? { nextPaymentAttempt } : {}),
        ...(failureMessage ? { failureMessage } : {}),
        lastSyncedAt: new Date(),
        ...(eventCreatedAt ? { lastStripeEventCreatedAt: eventCreatedAt } : {}),
      },
      $setOnInsert: {
        stripeAccountId,
        stripeInvoiceId: stripeInvoice.id,
      },
      $unset: {
        ...(!nextPaymentAttempt ? { nextPaymentAttempt: 1 } : {}),
        ...(!failureMessage ? { failureMessage: 1 } : {}),
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  await Subscription.updateOne(
    { _id: subscription._id, user: subscription.user },
    {
      $set: {
        latestStripeInvoiceId: stripeInvoice.id,
        ...(stripePaymentIntentId
          ? { latestStripePaymentIntentId: stripePaymentIntentId }
          : {}),
      },
    }
  );
  const previousRevenue =
    previousInvoice?.invoiceStatus === "paid" &&
    previousInvoice?.paymentStatus === "succeeded"
      ? previousInvoice.amountPaid
      : 0;
  const nextRevenue =
    invoice.invoiceStatus === "paid" && invoice.paymentStatus === "succeeded"
      ? invoice.amountPaid
      : 0;
  if (previousRevenue !== nextRevenue) {
    await SubscriptionPlan.updateOne(
      { _id: subscription.plan },
      { $inc: { totalRecurringRevenue: nextRevenue - previousRevenue } }
    );
  }
  return { invoice, subscription };
};

export const handleSubscriptionCheckoutCompleted = async (
  session,
  stripeAccountId,
  eventCreatedAt
) => {
  const stripeSubscriptionId = idOf(session.subscription);
  if (
    !stripeAccountId ||
    !stripeSubscriptionId ||
    session.mode !== "subscription"
  ) {
    return null;
  }

  const stripeSubscription = await retrieveStripeSubscription(
    stripeSubscriptionId,
    stripeAccountId
  );
  const synced = await syncSubscriptionRecord({
    stripeSubscription,
    stripeAccountId,
    customerDetails: session.customer_details || {},
    eventCreatedAt,
  });
  if (!synced) return null;

  const latestInvoiceId = idOf(stripeSubscription.latest_invoice);
  if (latestInvoiceId) {
    const latestInvoice = await retrieveStripeInvoice(
      latestInvoiceId,
      stripeAccountId
    );
    await syncSubscriptionInvoiceRecord({
      stripeInvoice: latestInvoice,
      stripeAccountId,
      eventType: "checkout.session.completed",
      eventCreatedAt,
    });
  }
  return synced;
};

export const handleSubscriptionLifecycleEvent = async (
  stripeSubscription,
  stripeAccountId,
  eventType,
  eventCreatedAt
) => {
  if (!stripeAccountId) return null;
  const latest =
    eventType === "customer.subscription.deleted"
      ? stripeSubscription
      : await retrieveStripeSubscription(
          stripeSubscription.id,
          stripeAccountId
        );
  return syncSubscriptionRecord({
    stripeSubscription: latest,
    stripeAccountId,
    eventCreatedAt,
  });
};

export const handleSubscriptionInvoiceEvent = async (
  stripeInvoice,
  stripeAccountId,
  eventType,
  eventCreatedAt
) => {
  if (!stripeAccountId) return null;
  const latest = await retrieveStripeInvoice(
    stripeInvoice.id,
    stripeAccountId
  );
  return syncSubscriptionInvoiceRecord({
    stripeInvoice: latest,
    stripeAccountId,
    eventType,
    eventCreatedAt,
  });
};
