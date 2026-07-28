import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";
import {
  createStripeSubscriptionPlan,
  createCustomerSubscriptionCheckout,
  deactivateStripeSubscriptionPlan,
  retrieveCustomerSubscriptionCheckout,
} from "../services/subscriptionStripe.service.js";
import { sendSubscriptionPlanEmail } from "../services/email.service.js";
import { requireIdempotencyKey } from "../services/idempotency.service.js";

export const createSubscriptionPlan = async (req, res) => {
  const plan = await createStripeSubscriptionPlan(
    req.user.id,
    req.body,
    requireIdempotencyKey(req)
  );
  res.status(201).json({
    success: true,
    message: "Subscription plan created",
    data: { plan },
  });
};

export const listSubscriptionPlans = async (req, res) => {
  const {
    page,
    limit,
    search: searchText,
    status,
    billingInterval,
  } = req.validated.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;
  if (billingInterval) filter.billingInterval = billingInterval;
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    filter.$or = [{ name: search }, { internalReference: search }];
  }

  const [items, total] = await Promise.all([
    SubscriptionPlan.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SubscriptionPlan.countDocuments(filter),
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

export const getSubscriptionPlan = async (req, res) => {
  const plan = await SubscriptionPlan.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  }).lean();
  if (!plan) {
    throw new AppError("Subscription plan not found", 404, "NOT_FOUND");
  }
  res.json({ success: true, data: { plan } });
};

export const deactivateSubscriptionPlan = async (req, res) => {
  const plan = await SubscriptionPlan.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  });
  if (!plan) {
    throw new AppError("Subscription plan not found", 404, "NOT_FOUND");
  }
  await deactivateStripeSubscriptionPlan(plan);
  res.json({
    success: true,
    message: "Subscription plan deactivated",
    data: { plan },
  });
};

const activeOwnedPlan = async (userId, planId) => {
  const plan = await SubscriptionPlan.findOne({
    _id: planId,
    user: userId,
  }).lean();
  if (!plan) {
    throw new AppError("Subscription plan not found", 404, "NOT_FOUND");
  }
  if (plan.status !== "active") {
    throw new AppError(
      "Only active subscription plans can create or share checkouts",
      409,
      "PLAN_INACTIVE"
    );
  }
  return plan;
};

export const createSubscriptionPlanCheckout = async (req, res) => {
  const plan = await activeOwnedPlan(req.user.id, req.validated.params.id);
  const { session, customer } = await createCustomerSubscriptionCheckout({
    userId: req.user.id,
    plan,
    customerId: req.body.customer,
    idempotencyKey: requireIdempotencyKey(req),
  });
  res.status(201).json({
    success: true,
    message: "Subscription checkout created",
    data: {
      checkout: {
        id: session.id,
        url: session.url,
        status: session.status,
        expiresAt: session.expires_at,
      },
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
      },
    },
  });
};

export const emailSubscriptionPlan = async (req, res) => {
  const plan = await activeOwnedPlan(req.user.id, req.validated.params.id);
  const { session, customer } = await retrieveCustomerSubscriptionCheckout({
    userId: req.user.id,
    plan,
    customerId: req.body.customer,
    checkoutSessionId: req.body.checkoutSessionId,
  });
  const email = await sendSubscriptionPlanEmail({
    user: req.user,
    plan,
    customer,
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    input: req.body,
  });
  res.status(202).json({
    success: true,
    message: "Subscription invitation queued",
    data: { email },
  });
};
