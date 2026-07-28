import { stripe } from "../config/providers.js";
import { CustomerStripeIdentity } from "../models/CustomerStripeIdentity.js";
import { AppError } from "../utils/AppError.js";

const getStripe = () => {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 503, "STRIPE_NOT_CONFIGURED");
  }
  return stripe;
};

export const ensureCustomerStripeIdentity = async ({
  customer,
  userId,
  stripeAccountId,
  source,
}) => {
  if (
    String(customer.user) !== String(userId) ||
    customer.stripeAccountId !== stripeAccountId ||
    customer.status !== "active"
  ) {
    throw new AppError(
      "Customer does not belong to this Stripe account",
      403,
      "CUSTOMER_OWNERSHIP_MISMATCH"
    );
  }

  const existing = await CustomerStripeIdentity.findOne({
    user: userId,
    customer: customer._id,
    stripeAccountId,
  });
  if (existing) return existing;

  const stripeCustomer = await getStripe().customers.create(
    {
      name: customer.name || undefined,
      email: customer.email,
      phone: customer.phone || undefined,
      metadata: {
        appCustomerId: String(customer._id),
        appUserId: String(userId),
      },
    },
    {
      stripeAccount: stripeAccountId,
      idempotencyKey: `payflow-customer:${customer._id}`,
    }
  );

  try {
    return await CustomerStripeIdentity.create({
      user: userId,
      customer: customer._id,
      stripeAccountId,
      stripeCustomerId: stripeCustomer.id,
      source,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const identity = await CustomerStripeIdentity.findOne({
      user: userId,
      customer: customer._id,
      stripeAccountId,
    });
    if (!identity) throw error;
    return identity;
  }
};
