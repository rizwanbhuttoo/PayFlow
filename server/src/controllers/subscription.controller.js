import { Subscription } from "../models/Subscription.js";
import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";
import {
  cancelStripeSubscriptionImmediately,
  createStripeCustomerPortalSession,
  updateStripeSubscriptionCancellation,
} from "../services/subscriptionStripe.service.js";
import { syncSubscriptionRecord } from "../services/subscriptionWebhook.service.js";
import { sendSubscriptionLifecycleEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import { logError } from "../utils/logger.js";
import {
  beginIdempotentOperation,
  failIdempotentOperation,
  requireIdempotencyKey,
} from "../services/idempotency.service.js";

const ownedSubscription = (userId, id) =>
  Subscription.findOne({ _id: id, user: userId });

export const listSubscriptions = async (req, res) => {
  const {
    page,
    limit,
    search: searchText,
    status,
    plan,
    billingInterval,
    from,
    to,
  } = req.validated.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;
  if (plan) filter.plan = plan;
  if (billingInterval) filter.billingInterval = billingInterval;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    const matchingPlans = await SubscriptionPlan.find({
      user: req.user.id,
      $or: [{ name: search }, { internalReference: search }],
    }).distinct("_id");
    filter.$or = [
      { customerName: search },
      { customerEmail: search },
      { stripeSubscriptionId: search },
      { plan: { $in: matchingPlans } },
    ];
  }

  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .populate("plan", "name internalReference")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
};

export const getSubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  })
    .populate("plan")
    .populate("customer")
    .lean();
  if (!subscription) {
    throw new AppError("Subscription not found", 404, "NOT_FOUND");
  }
  const invoices = await SubscriptionInvoice.find({
    user: req.user.id,
    subscription: subscription._id,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .lean();
  res.json({ success: true, data: { subscription, invoices } });
};

export const getSubscriptionInvoices = async (req, res) => {
  const { page, limit } = req.validated.query;
  const subscription = await Subscription.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  }).lean();
  if (!subscription) {
    throw new AppError("Subscription not found", 404, "NOT_FOUND");
  }
  const filter = {
    user: req.user.id,
    subscription: subscription._id,
  };
  const [items, total] = await Promise.all([
    SubscriptionInvoice.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SubscriptionInvoice.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
};

const sendScheduledCancellationEmail = async (subscription) => {
  const [plan, user] = await Promise.all([
    SubscriptionPlan.findById(subscription.plan).lean(),
    User.findById(subscription.user).lean(),
  ]);
  if (!plan || !user) return;
  try {
    await sendSubscriptionLifecycleEmail({
      user,
      plan,
      subscription,
      kind: "cancellation_scheduled",
    });
  } catch (error) {
    logError("Scheduled cancellation email failed", error);
  }
};

export const cancelSubscription = async (req, res) => {
  const subscription = await ownedSubscription(
    req.user.id,
    req.validated.params.id
  );
  if (!subscription) {
    throw new AppError("Subscription not found", 404, "NOT_FOUND");
  }
  const idempotencyKey = requireIdempotencyKey(req);
  const { operation, replay } = await beginIdempotentOperation({
    user: req.user.id,
    operationType: "subscription_cancel",
    idempotencyKey,
    input: {
      subscriptionId: String(subscription._id),
      type: req.body.type,
      reason: req.body.reason || "",
    },
  });
  if (replay) {
    const current = await Subscription.findOne({
      _id: subscription._id,
      user: req.user.id,
    });
    return res.json({
      success: true,
      message: "Cancellation request already completed",
      data: { subscription: current },
    });
  }
  operation.localResourceId = subscription._id;
  operation.status = "started";
  await operation.save();
  if (
    ["canceled", "incomplete_expired"].includes(subscription.status)
  ) {
    throw new AppError(
      "This subscription has already ended",
      409,
      "SUBSCRIPTION_ENDED"
    );
  }

  const cancelAtPeriodEnd = req.body.type === "period_end";
  if (cancelAtPeriodEnd && subscription.cancelAtPeriodEnd) {
    throw new AppError(
      "Cancellation is already scheduled",
      409,
      "CANCELLATION_ALREADY_SCHEDULED"
    );
  }

  let stripeSubscription;
  try {
    const stripeKey = `payflow:subscription_cancel:${idempotencyKey}:${req.body.type}`;
    stripeSubscription = cancelAtPeriodEnd
      ? await updateStripeSubscriptionCancellation({
          subscription,
          cancelAtPeriodEnd: true,
          idempotencyKey: stripeKey,
        })
      : await cancelStripeSubscriptionImmediately(subscription, stripeKey);
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }
  const synced = await syncSubscriptionRecord({
    stripeSubscription,
    stripeAccountId: subscription.stripeAccountId,
  });
  if (!synced) {
    throw new AppError(
      "Stripe updated the subscription but local synchronization failed",
      502,
      "SUBSCRIPTION_SYNC_FAILED"
    );
  }
  if (req.body.reason) {
    synced.subscription.cancellationReason = req.body.reason;
    await synced.subscription.save();
  }
  if (cancelAtPeriodEnd) {
    await sendScheduledCancellationEmail(synced.subscription);
  }
  operation.status = "completed";
  operation.completedAt = new Date();
  operation.stripeSubscriptionId = subscription.stripeSubscriptionId;
  await operation.save();

  res.json({
    success: true,
    message: cancelAtPeriodEnd
      ? "Cancellation scheduled for the end of the billing period"
      : "Subscription canceled immediately",
    data: { subscription: synced.subscription },
  });
};

export const removeScheduledCancellation = async (req, res) => {
  const subscription = await ownedSubscription(
    req.user.id,
    req.validated.params.id
  );
  if (!subscription) {
    throw new AppError("Subscription not found", 404, "NOT_FOUND");
  }
  if (!subscription.cancelAtPeriodEnd) {
    throw new AppError(
      "This subscription is not scheduled for cancellation",
      409,
      "CANCELLATION_NOT_SCHEDULED"
    );
  }
  if (subscription.status === "canceled") {
    throw new AppError(
      "A canceled subscription cannot be resumed",
      409,
      "SUBSCRIPTION_ENDED"
    );
  }

  const stripeSubscription = await updateStripeSubscriptionCancellation({
    subscription,
    cancelAtPeriodEnd: false,
  });
  const synced = await syncSubscriptionRecord({
    stripeSubscription,
    stripeAccountId: subscription.stripeAccountId,
  });
  if (!synced) {
    throw new AppError(
      "Stripe updated the subscription but local synchronization failed",
      502,
      "SUBSCRIPTION_SYNC_FAILED"
    );
  }
  res.json({
    success: true,
    message: "Scheduled cancellation removed",
    data: { subscription: synced.subscription },
  });
};

export const createCustomerPortal = async (req, res) => {
  const subscription = await Subscription.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  }).lean();
  if (!subscription) {
    throw new AppError("Subscription not found", 404, "NOT_FOUND");
  }
  if (!subscription.stripeCustomerId) {
    throw new AppError(
      "Stripe customer is unavailable",
      409,
      "STRIPE_CUSTOMER_MISSING"
    );
  }
  const portal = await createStripeCustomerPortalSession({
    stripeAccountId: subscription.stripeAccountId,
    stripeCustomerId: subscription.stripeCustomerId,
    returnUrl: `${env.clientUrl}/subscriptions/${subscription._id}`,
  });
  res.status(201).json({ success: true, data: { url: portal.url } });
};
