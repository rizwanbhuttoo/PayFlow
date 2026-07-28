import mongoose from "mongoose";
import { stripe } from "../config/providers.js";
import { env } from "../config/env.js";
import { StripeAccount } from "../models/StripeAccount.js";
import { PaymentLink } from "../models/PaymentLink.js";
import { Customer } from "../models/Customer.js";
import { AppError } from "../utils/AppError.js";
import {
  beginIdempotentOperation,
  failIdempotentOperation,
  stripeIdempotencyOptions,
} from "./idempotency.service.js";
import { ensureCustomerStripeIdentity } from "./customerStripe.service.js";

const getStripe = () => {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 503, "STRIPE_NOT_CONFIGURED");
  }
  return stripe;
};

const addCheckoutSessionToRedirect = (redirectUrl) => {
  const url = new URL(redirectUrl);
  const hash = url.hash;
  url.hash = "";
  return `${url.toString()}${url.search ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}${hash}`;
};

export const deriveOnboardingStatus = (account) => {
  if (account.charges_enabled && account.details_submitted) return "completed";
  if (account.requirements?.disabled_reason) return "restricted";
  if (account.details_submitted) return "pending";
  return "not_started";
};

export const syncStripeAccount = async (account, userId) =>
  StripeAccount.findOneAndUpdate(
    { stripeAccountId: account.id },
    {
      ...(userId ? { user: userId } : {}),
      onboardingStatus: deriveOnboardingStatus(account),
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      country: account.country,
      defaultCurrency: account.default_currency,
      ...(account.details_submitted ? { connectedAt: new Date() } : {}),
    },
    { new: true, upsert: Boolean(userId), runValidators: true }
  );

export const getOrCreateConnectAccount = async (user) => {
  const existing = await StripeAccount.findOne({ user: user.id }).lean();
  if (existing) return existing;

  const account = await getStripe().accounts.create({
    type: "express",
    email: user.email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { userId: user.id },
  });

  return syncStripeAccount(account, user.id);
};

export const createAccountLink = async (user) => {
  const record = await getOrCreateConnectAccount(user);
  const link = await getStripe().accountLinks.create({
    account: record.stripeAccountId,
    refresh_url: env.stripeRefreshUrl,
    return_url: env.stripeReturnUrl,
    type: "account_onboarding",
  });
  return link.url;
};

export const refreshConnectAccount = async (userId) => {
  const record = await StripeAccount.findOne({ user: userId }).lean();
  if (!record) return null;
  const account = await getStripe().accounts.retrieve(record.stripeAccountId);
  return syncStripeAccount(account);
};

export const createDashboardLoginLink = async (userId) => {
  const record = await StripeAccount.findOne({ user: userId }).lean();
  if (!record) throw new AppError("Connect Stripe first", 409, "STRIPE_NOT_CONNECTED");
  const loginLink = await getStripe().accounts.createLoginLink(record.stripeAccountId);
  return loginLink.url;
};

export const createStripePaymentLink = async (userId, input, idempotencyKey) => {
  const account = await refreshConnectAccount(userId);
  if (!account?.chargesEnabled) {
    throw new AppError(
      "Stripe onboarding must be complete and charges enabled before creating a payment request",
      409,
      "STRIPE_CHARGES_DISABLED"
    );
  }
  const customer = await Customer.findOne({
    _id: input.customer,
    user: userId,
    stripeAccountId: account.stripeAccountId,
    status: "active",
  });
  if (!customer) {
    throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const { operation, replay } = await beginIdempotentOperation({
    user: userId,
    operationType: "payment_link_create",
    idempotencyKey,
    input,
  });
  if (replay) {
    const existing = await PaymentLink.findOne({
      _id: operation.localResourceId,
      user: userId,
    });
    if (existing) return existing;
  }
  operation.status = "started";
  operation.errorMessage = undefined;
  operation.localResourceId ||= new mongoose.Types.ObjectId();
  await operation.save();

  const id = operation.localResourceId;
  const customerIdentity = await ensureCustomerStripeIdentity({
    customer,
    userId,
    stripeAccountId: account.stripeAccountId,
    source: "one_time",
  });
  const product = await getStripe().products.create(
    {
      name: input.title,
      description: input.description || undefined,
      metadata: {
        appPaymentLinkId: id.toString(),
        appCustomerId: customer.id,
        appUserId: String(userId),
      },
    },
    stripeIdempotencyOptions(operation, "product", account.stripeAccountId)
  );
  operation.stripeProductId = product.id;
  await operation.save();

  let price;
  let checkoutSession;
  try {
    price = await getStripe().prices.create(
      {
        product: product.id,
        unit_amount: input.amount,
        currency: input.currency,
      },
      stripeIdempotencyOptions(operation, "price", account.stripeAccountId)
    );
    operation.stripePriceId = price.id;
    await operation.save();

    const successUrl = input.redirectUrl
      ? input.redirectUrl
      : `${env.clientUrl}/payment-success`;
    const successRedirectUrl = addCheckoutSessionToRedirect(successUrl);
    const expiresAt =
      input.expiresAt ||
      new Date(Date.now() + (24 * 60 * 60 - 60) * 1000);

    checkoutSession = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerIdentity.stripeCustomerId,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: successRedirectUrl,
        cancel_url: `${env.clientUrl}/payment-canceled`,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        metadata: {
          appPaymentLinkId: id.toString(),
          appCustomerId: customer.id,
          appUserId: userId.toString(),
          ...(input.internalReference ? { internalReference: input.internalReference } : {}),
        },
        payment_intent_data: {
          metadata: {
            appPaymentLinkId: id.toString(),
            appCustomerId: customer.id,
            appUserId: userId.toString(),
          },
          ...(env.stripeFeePercent > 0
            ? {
                application_fee_amount: Math.round(
                  (input.amount * env.stripeFeePercent) / 100
                ),
              }
            : {}),
        },
      },
      stripeIdempotencyOptions(
        operation,
        "checkout-session",
        account.stripeAccountId
      )
    );
    operation.stripeCheckoutSessionId = checkoutSession.id;
    await operation.save();
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }

  try {
    const link = await PaymentLink.findOneAndUpdate(
      { _id: id, user: userId },
      {
        user: userId,
        customer: customer._id,
        stripeAccountId: account.stripeAccountId,
        ...input,
        intendedRecipientEmail: customer.email,
        stripeProductId: product.id,
        stripePriceId: price.id,
        stripeCheckoutSessionId: checkoutSession.id,
        checkoutType: "customer_session",
        publicUrl: checkoutSession.url,
        expiresAt: new Date(checkoutSession.expires_at * 1000),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    operation.status = "completed";
    operation.completedAt = new Date();
    await operation.save();
    return link;
  } catch (error) {
    await failIdempotentOperation(operation, error);
    throw error;
  }
};

export const deactivateStripePaymentLink = async (link) => {
  if (link.stripeCheckoutSessionId) {
    try {
      await getStripe().checkout.sessions.expire(
        link.stripeCheckoutSessionId,
        {},
        { stripeAccount: link.stripeAccountId }
      );
    } catch (error) {
      if (error.code !== "checkout_session_not_open") throw error;
    }
  } else if (link.stripePaymentLinkId) {
    await getStripe().paymentLinks.update(
      link.stripePaymentLinkId,
      { active: false },
      { stripeAccount: link.stripeAccountId }
    );
  }
  link.status = "inactive";
  await link.save();
  return link;
};

export const expireStripePaymentLink = async (link) => {
  if (link.stripeCheckoutSessionId) {
    try {
      await getStripe().checkout.sessions.expire(
        link.stripeCheckoutSessionId,
        {},
        { stripeAccount: link.stripeAccountId }
      );
    } catch (error) {
      if (error.code !== "checkout_session_not_open") throw error;
    }
  } else if (link.stripePaymentLinkId) {
    await getStripe().paymentLinks.update(
      link.stripePaymentLinkId,
      { active: false },
      { stripeAccount: link.stripeAccountId }
    );
  }
  link.status = "expired";
  link.expiryStatus = "completed";
  link.expiryLockedAt = undefined;
  link.expiryError = undefined;
  await link.save();
  return link;
};
