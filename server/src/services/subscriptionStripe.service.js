import mongoose from "mongoose";
import { stripe } from "../config/providers.js";
import { env } from "../config/env.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { Customer } from "../models/Customer.js";
import { AppError } from "../utils/AppError.js";
import { refreshConnectAccount } from "./stripe.service.js";
import {
  beginIdempotentOperation,
  failIdempotentOperation,
  stripeIdempotencyOptions,
} from "./idempotency.service.js";
import { ensureCustomerStripeIdentity } from "./customerStripe.service.js";

const intervalMap = {
  monthly: "month",
  yearly: "year",
};

const getStripe = () => {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 503, "STRIPE_NOT_CONFIGURED");
  }
  return stripe;
};

const requestOptions = (stripeAccountId) => ({
  stripeAccount: stripeAccountId,
});

const getChargeEnabledAccount = async (userId) => {
  const account = await refreshConnectAccount(userId);
  if (!account?.chargesEnabled || account.onboardingStatus !== "completed") {
    throw new AppError(
      "Stripe onboarding must be complete and charges enabled before creating a subscription plan",
      409,
      "STRIPE_CHARGES_DISABLED"
    );
  }
  return account;
};

export const createStripeSubscriptionPlan = async (
  userId,
  input,
  idempotencyKey
) => {
  const { operation, replay } = await beginIdempotentOperation({
    user: userId,
    operationType: "subscription_plan_create",
    idempotencyKey,
    input,
  });
  if (replay) {
    const existing = await SubscriptionPlan.findOne({
      _id: operation.localResourceId,
      user: userId,
    });
    if (existing) return existing;
  }
  operation.status = "started";
  operation.errorMessage = undefined;
  operation.localResourceId ||= new mongoose.Types.ObjectId();
  await operation.save();

  const account = await getChargeEnabledAccount(userId);
  const id = operation.localResourceId;
  const metadata = {
    appSubscriptionPlanId: id.toString(),
    appUserId: userId.toString(),
    appStripeAccountId: account.stripeAccountId,
    ...(input.internalReference
      ? { internalReference: input.internalReference }
      : {}),
  };

  const product = await getStripe().products.create(
    {
      name: input.name,
      description: input.description || undefined,
      metadata,
    },
    stripeIdempotencyOptions(operation, "product", account.stripeAccountId)
  );
  operation.stripeProductId = product.id;
  await operation.save();

  let price;
  try {
    price = await getStripe().prices.create(
      {
        product: product.id,
        unit_amount: input.amount,
        currency: input.currency,
        recurring: { interval: intervalMap[input.billingInterval] },
        metadata,
      },
      stripeIdempotencyOptions(operation, "price", account.stripeAccountId)
    );
    operation.stripePriceId = price.id;
    await operation.save();
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }

  try {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { _id: id, user: userId },
      {
        user: userId,
        stripeAccountId: account.stripeAccountId,
        ...input,
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    operation.status = "completed";
    operation.completedAt = new Date();
    await operation.save();
    return plan;
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }
};

export const deactivateStripeSubscriptionPlan = async (plan) => {
  if (plan.status !== "active") {
    throw new AppError(
      "This subscription plan is already inactive",
      409,
      "PLAN_INACTIVE"
    );
  }
  const options = requestOptions(plan.stripeAccountId);
  if (plan.stripePaymentLinkId) {
    await getStripe().paymentLinks.update(
      plan.stripePaymentLinkId,
      { active: false },
      options
    );
  }
  await getStripe().prices.update(
    plan.stripePriceId,
    { active: false },
    options
  );
  plan.status = "inactive";
  await plan.save();
  return plan;
};

export const createCustomerSubscriptionCheckout = async ({
  userId,
  plan,
  customerId,
  idempotencyKey,
}) => {
  const customer = await Customer.findOne({
    _id: customerId,
    user: userId,
    stripeAccountId: plan.stripeAccountId,
    status: "active",
  });
  if (!customer) {
    throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
  }
  if (!customer.email) {
    throw new AppError(
      "Customer must have an email before receiving a subscription",
      409,
      "CUSTOMER_EMAIL_REQUIRED"
    );
  }

  const { operation, replay } = await beginIdempotentOperation({
    user: userId,
    operationType: "subscription_invitation",
    idempotencyKey,
    input: {
      plan: String(plan._id),
      customer: String(customer._id),
    },
  });
  if (replay && operation.stripeCheckoutSessionId) {
    const session = await getStripe().checkout.sessions.retrieve(
      operation.stripeCheckoutSessionId,
      {},
      requestOptions(plan.stripeAccountId)
    );
    return { session, customer };
  }
  operation.status = "started";
  operation.localResourceId = plan._id;
  operation.errorMessage = undefined;
  await operation.save();

  try {
    const identity = await ensureCustomerStripeIdentity({
      customer,
      userId,
      stripeAccountId: plan.stripeAccountId,
      source: "subscription",
    });
    const successUrl = new URL("/subscription-success", env.clientUrl);
    successUrl.searchParams.set("plan", String(plan._id));
    const successRedirectUrl = `${successUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`;
    const metadata = {
      appSubscriptionPlanId: String(plan._id),
      appCustomerId: String(customer._id),
      appUserId: String(userId),
      appStripeAccountId: plan.stripeAccountId,
    };
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "subscription",
        customer: identity.stripeCustomerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: successRedirectUrl,
        cancel_url: `${env.clientUrl}/subscription-canceled`,
        metadata,
        subscription_data: {
          metadata,
          ...(env.stripeFeePercent > 0
            ? { application_fee_percent: env.stripeFeePercent }
            : {}),
        },
      },
      stripeIdempotencyOptions(
        operation,
        "checkout-session",
        plan.stripeAccountId
      )
    );
    operation.stripeCheckoutSessionId = session.id;
    operation.status = "completed";
    operation.completedAt = new Date();
    await operation.save();
    return { session, customer };
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }
};

export const retrieveCustomerSubscriptionCheckout = async ({
  userId,
  plan,
  customerId,
  checkoutSessionId,
}) => {
  const customer = await Customer.findOne({
    _id: customerId,
    user: userId,
    stripeAccountId: plan.stripeAccountId,
    status: "active",
  });
  if (!customer) {
    throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
  }
  const session = await getStripe().checkout.sessions.retrieve(
    checkoutSessionId,
    {},
    requestOptions(plan.stripeAccountId)
  );
  if (
    session.mode !== "subscription" ||
    session.metadata?.appSubscriptionPlanId !== String(plan._id) ||
    session.metadata?.appCustomerId !== String(customer._id) ||
    session.metadata?.appUserId !== String(userId)
  ) {
    throw new AppError(
      "Checkout Session does not belong to this customer and plan",
      403,
      "CHECKOUT_SESSION_MISMATCH"
    );
  }
  if (session.status !== "open" || !session.url) {
    throw new AppError(
      "Only an open Checkout Session can be shared",
      409,
      "CHECKOUT_SESSION_NOT_OPEN"
    );
  }
  return { session, customer };
};

export const retrieveSubscriptionCheckout = async (plan, sessionId) => {
  const session = await getStripe().checkout.sessions.retrieve(
    sessionId,
    { expand: ["customer", "subscription", "subscription.latest_invoice"] },
    requestOptions(plan.stripeAccountId)
  );
  const metadataPlanId =
    session.metadata?.appSubscriptionPlanId ||
    session.subscription?.metadata?.appSubscriptionPlanId;
  const paymentLinkId =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id;

  if (
    session.mode !== "subscription" ||
    (metadataPlanId !== String(plan._id) &&
      paymentLinkId !== plan.stripePaymentLinkId)
  ) {
    throw new AppError(
      "Checkout session does not belong to this plan",
      403,
      "CHECKOUT_SESSION_MISMATCH"
    );
  }
  return session;
};

export const updateStripeSubscriptionCancellation = async ({
  subscription,
  cancelAtPeriodEnd,
  idempotencyKey,
}) =>
  getStripe().subscriptions.update(
    subscription.stripeSubscriptionId,
    { cancel_at_period_end: cancelAtPeriodEnd },
    {
      ...requestOptions(subscription.stripeAccountId),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }
  );

export const cancelStripeSubscriptionImmediately = async (
  subscription,
  idempotencyKey
) =>
  getStripe().subscriptions.cancel(
    subscription.stripeSubscriptionId,
    { invoice_now: false, prorate: false },
    {
      ...requestOptions(subscription.stripeAccountId),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }
  );

export const createStripeCustomerPortalSession = async ({
  stripeAccountId,
  stripeCustomerId,
  returnUrl,
}) =>
  getStripe().billingPortal.sessions.create(
    {
      customer: stripeCustomerId,
      return_url: returnUrl || `${env.clientUrl}/subscriptions`,
    },
    requestOptions(stripeAccountId)
  );

export const retrieveStripeSubscription = (stripeSubscriptionId, stripeAccountId) =>
  getStripe().subscriptions.retrieve(
    stripeSubscriptionId,
    {
      expand: [
        "customer",
        "latest_invoice",
      ],
    },
    requestOptions(stripeAccountId)
  );

export const retrieveStripeInvoice = (stripeInvoiceId, stripeAccountId) =>
  getStripe().invoices.retrieve(
    stripeInvoiceId,
    {
      expand: [
        "customer",
        "parent.subscription_details.subscription",
        "payments.data.payment.payment_intent",
      ],
    },
    requestOptions(stripeAccountId)
  );

export const retrieveStripeCustomer = (stripeCustomerId, stripeAccountId) =>
  getStripe().customers.retrieve(
    stripeCustomerId,
    {},
    requestOptions(stripeAccountId)
  );
