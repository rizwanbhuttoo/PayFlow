import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { Subscription } from "../models/Subscription.js";
import { AppError } from "../utils/AppError.js";
import {
  createStripeCustomerPortalSession,
  retrieveSubscriptionCheckout,
} from "../services/subscriptionStripe.service.js";
import {
  deriveLocalSubscriptionStatus,
  getStripeSubscriptionPeriod,
  handleSubscriptionCheckoutCompleted,
  isCompletedSubscriptionCheckout,
} from "../services/subscriptionWebhook.service.js";
import { env } from "../config/env.js";
import {
  consumeCustomerManagementToken,
  verifyCustomerManagementToken,
} from "../services/customerManagementToken.service.js";
import { logError } from "../utils/logger.js";

const getPlanAndSession = async ({ planId, sessionId }) => {
  const plan = await SubscriptionPlan.findById(planId).lean();
  if (!plan) {
    throw new AppError("Subscription plan not found", 404, "NOT_FOUND");
  }
  const session = await retrieveSubscriptionCheckout(plan, sessionId);
  return { plan, session };
};

const maskEmail = (email) => {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
};

export const getSubscriptionCheckoutSummary = async (req, res) => {
  const { planId, sessionId } = req.validated.params;
  const { plan, session } = await getPlanAndSession({ planId, sessionId });
  const stripeSubscription =
    typeof session.subscription === "object" ? session.subscription : null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const findLocalSubscription = () =>
    stripeSubscriptionId
      ? Subscription.findOne({
          stripeAccountId: plan.stripeAccountId,
          stripeSubscriptionId,
        }).lean()
      : null;
  let localSubscription = await findLocalSubscription();

  // The verified webhook remains the normal synchronization path. This
  // Stripe-authenticated lookup repairs a completed Checkout when delivery is
  // delayed or a local Connect webhook forwarder was temporarily unavailable.
  if (
    !localSubscription &&
    isCompletedSubscriptionCheckout(session)
  ) {
    try {
      const synced = await handleSubscriptionCheckoutCompleted(
        session,
        plan.stripeAccountId
      );
      localSubscription = synced?.subscription || null;
    } catch (error) {
      logError("Subscription Checkout reconciliation failed", error);
      // The subscription may have been persisted before invoice reconciliation
      // failed, so read it once more before reporting a pending sync.
      localSubscription = await findLocalSubscription();
    }
  }
  const period = stripeSubscription
    ? getStripeSubscriptionPeriod(stripeSubscription)
    : {};

  res.json({
    success: true,
    data: {
      checkout: {
        paymentStatus: session.payment_status,
        syncStatus: localSubscription ? "synced" : "pending",
        status:
          localSubscription?.status ||
          (stripeSubscription
            ? deriveLocalSubscriptionStatus(stripeSubscription)
            : "incomplete"),
        customerEmail:
          maskEmail(
            session.customer_details?.email ||
              localSubscription?.customerEmail
          ),
        nextBillingDate:
          localSubscription?.currentPeriodEnd || period.end || null,
      },
      plan: {
        _id: plan._id,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        successMessage: plan.successMessage,
        redirectUrl: plan.redirectUrl,
      },
    },
  });
};

const subscriptionForToken = async (record) => {
  const subscription = await Subscription.findOne({
    _id: record.subscription,
    user: record.user,
    customer: record.customer,
    stripeAccountId: record.stripeAccountId,
  }).populate("plan", "name amount currency billingInterval");
  if (!subscription) {
    throw new AppError("Subscription is unavailable", 404, "NOT_FOUND");
  }
  return subscription;
};

export const getManagementSummary = async (req, res) => {
  const record = await verifyCustomerManagementToken(req.body.token);
  const subscription = await subscriptionForToken(record);
  res.json({
    success: true,
    data: {
      subscription: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        customerEmail: maskEmail(subscription.customerEmail),
      },
      plan: subscription.plan,
    },
  });
};

export const createPublicCustomerPortal = async (req, res) => {
  const record = await consumeCustomerManagementToken(req.body.token);
  const subscription = await subscriptionForToken(record);
  const portal = await createStripeCustomerPortalSession({
    stripeAccountId: subscription.stripeAccountId,
    stripeCustomerId: subscription.stripeCustomerId,
    returnUrl: `${env.clientUrl}/manage-subscription`,
  });
  res.status(201).json({ success: true, data: { url: portal.url } });
};
