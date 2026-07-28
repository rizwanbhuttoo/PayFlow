import { env } from "../config/env.js";
import { EmailLog } from "../models/EmailLog.js";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const layout = ({ eyebrow, title, body, buttonLabel, buttonUrl, footer }) => `
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#172033">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 35px rgba(20,31,56,.08)">
        <tr><td style="padding:34px 38px">
          <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#635bff">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:12px 0 16px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>
          <div style="font-size:16px;line-height:1.7;color:#586176">${body}</div>
          ${buttonUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#635bff;color:white;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${escapeHtml(buttonLabel)}</a></p>` : ""}
          <p style="font-size:12px;line-height:1.6;color:#8790a4;margin-top:30px">${escapeHtml(footer || "Sent securely with PayFlow.")}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const deliver = async ({
  userId,
  paymentLinkId,
  subscriptionPlanId,
  subscriptionId,
  invoiceId,
  customerId,
  dedupeKey,
  kind,
  to,
  recipientName,
  subject,
  message,
  html,
}) => {
  if (dedupeKey) {
    const existing = await EmailLog.findOne({ dedupeKey });
    if (existing && !["failed", "dead_letter"].includes(existing.status)) {
      return existing;
    }
    if (existing) {
      return EmailLog.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            user: userId,
            paymentLink: paymentLinkId,
            customer: customerId,
            subscriptionPlan: subscriptionPlanId,
            subscription: subscriptionId,
            invoice: invoiceId,
            kind,
            recipientName,
            recipientEmail: to,
            customerEmailSnapshot: to,
            subject,
            message,
            html,
            status: "queued",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
          $unset: {
            errorMessage: 1,
            providerMessageId: 1,
            providerStatusCode: 1,
            sentAt: 1,
            lockedAt: 1,
            lockedBy: 1,
          },
        },
        { new: true }
      );
    }
  }

  let log;
  try {
    log = await EmailLog.create({
      user: userId,
      paymentLink: paymentLinkId,
      customer: customerId,
      subscriptionPlan: subscriptionPlanId,
      subscription: subscriptionId,
      invoice: invoiceId,
      dedupeKey,
      kind,
      recipientName,
      recipientEmail: to,
      customerEmailSnapshot: to,
      subject,
      message,
      html,
      status: "queued",
    });
  } catch (error) {
    if (error.code === 11000 && dedupeKey) {
      return EmailLog.findOne({ dedupeKey });
    }
    throw error;
  }

  return log;
};

export const sendVerificationEmail = ({ user, token }) => {
  const url = `${env.clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your PayFlow email";
  return deliver({
    userId: user.id,
    kind: "verification",
    to: user.email,
    recipientName: user.firstName,
    subject,
    message: "Verify your email address.",
    html: layout({
      eyebrow: "Welcome to PayFlow",
      title: `Verify your email, ${user.firstName}`,
      body: "Confirm your email address to activate your account and start creating secure payment links.",
      buttonLabel: "Verify email",
      buttonUrl: url,
      footer: "This link expires in 24 hours. If you did not create this account, ignore this email.",
    }),
  });
};

export const sendPasswordResetEmail = ({ user, token }) => {
  const url = `${env.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your PayFlow password";
  return deliver({
    userId: user.id,
    kind: "password_reset",
    to: user.email,
    recipientName: user.firstName,
    subject,
    message: "A password reset was requested.",
    html: layout({
      eyebrow: "Account security",
      title: "Reset your password",
      body: "Use the secure link below to choose a new password.",
      buttonLabel: "Reset password",
      buttonUrl: url,
      footer: "This link expires in one hour. If you did not request it, you can ignore this email.",
    }),
  });
};

export const sendPaymentLinkEmail = ({ user, paymentLink, customer, input }) => {
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: paymentLink.currency.toUpperCase(),
  }).format(paymentLink.amount / 100);
  const sender = `${user.firstName} ${user.lastName}`.trim();
  const subject = input.subject || `${sender} sent you a payment request`;
  const personalMessage = input.message
    ? `<p style="padding:14px 16px;background:#f4f7fb;border-radius:10px">${escapeHtml(input.message)}</p>`
    : "";

  return deliver({
    userId: user.id,
    paymentLinkId: paymentLink._id || paymentLink.id,
    customerId: customer._id || customer.id,
    kind: "payment_link",
    to: customer.email,
    recipientName: customer.name,
    subject,
    message: input.message,
    html: layout({
      eyebrow: "Secure payment request",
      title: paymentLink.title,
      body: `${customer.name ? `<p>Hello ${escapeHtml(customer.name)},</p>` : ""}<p><strong>${escapeHtml(amount)}</strong> requested by ${escapeHtml(sender)}.</p>${paymentLink.description ? `<p>${escapeHtml(paymentLink.description)}</p>` : ""}${personalMessage}`,
      buttonLabel: `Pay ${amount}`,
      buttonUrl: paymentLink.publicUrl,
      footer: "Payment is processed securely on Stripe. PayFlow never stores card details.",
    }),
  });
};

const formatRecurringAmount = (plan) => {
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
  }).format(plan.amount / 100);
  const interval = plan.billingInterval === "yearly" ? "year" : "month";
  return `${amount} per ${interval}`;
};

export const sendSubscriptionPlanEmail = ({
  user,
  plan,
  customer,
  checkoutUrl,
  checkoutSessionId,
  input,
}) => {
  const sender = `${user.firstName} ${user.lastName}`.trim();
  const recurringAmount = formatRecurringAmount(plan);
  const personalMessage = input.message
    ? `<p style="padding:14px 16px;background:#f4f7fb;border-radius:10px">${escapeHtml(input.message)}</p>`
    : "";

  return deliver({
    userId: user._id || user.id,
    subscriptionPlanId: plan._id || plan.id,
    customerId: customer._id || customer.id,
    dedupeKey: `subscription_invitation:${plan.stripeAccountId}:${checkoutSessionId}`,
    kind: "subscription_invitation",
    to: customer.email,
    recipientName: customer.name,
    subject: input.subject,
    message: input.message,
    html: layout({
      eyebrow: "Subscription invitation",
      title: plan.name,
      body: `${customer.name ? `<p>Hello ${escapeHtml(customer.name)},</p>` : ""}<p>${escapeHtml(sender)} invited you to subscribe for <strong>${escapeHtml(recurringAmount)}</strong>.</p>${plan.description ? `<p>${escapeHtml(plan.description)}</p>` : ""}${personalMessage}<p>This payment repeats automatically every ${plan.billingInterval === "yearly" ? "year" : "month"} until canceled. You can manage or cancel the subscription through Stripe’s secure customer portal.</p>`,
      buttonLabel: `Subscribe for ${recurringAmount}`,
      buttonUrl: checkoutUrl,
      footer:
        "Checkout and recurring payments are processed securely by Stripe. PayFlow never stores full card details.",
    }),
  });
};

const lifecycleEmailContent = ({ kind, plan, subscription }) => {
  const recurringAmount = formatRecurringAmount(plan);
  const periodEnd = subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
        new Date(subscription.currentPeriodEnd)
      )
    : null;

  if (kind === "subscription_started") {
    return {
      eyebrow: "Subscription active",
      title: `You’re subscribed to ${plan.name}`,
      body: `<p>Your subscription for <strong>${escapeHtml(recurringAmount)}</strong> is active.</p>${periodEnd ? `<p>Your next billing date is ${escapeHtml(periodEnd)}.</p>` : ""}`,
      footer:
        "Stripe will securely process future recurring payments according to this plan.",
    };
  }
  if (kind === "cancellation_scheduled") {
    return {
      eyebrow: "Cancellation scheduled",
      title: `${plan.name} will not renew`,
      body: `<p>Your subscription remains available through the current billing period${periodEnd ? ` ending <strong>${escapeHtml(periodEnd)}</strong>` : ""}.</p><p>No further renewal will be collected after it ends.</p>`,
      footer: "Contact the business if this cancellation was unexpected.",
    };
  }
  return {
    eyebrow: "Subscription canceled",
    title: `${plan.name} has ended`,
    body:
      "<p>Your subscription has been canceled and no future recurring charges will be collected.</p><p>Cancellation does not automatically refund a previous payment.</p>",
    footer: "Contact the business if you have questions about this subscription.",
  };
};

export const sendSubscriptionLifecycleEmail = ({
  user,
  plan,
  subscription,
  kind,
}) => {
  if (!subscription.customerEmail) return null;
  const content = lifecycleEmailContent({ kind, plan, subscription });
  return deliver({
    userId: user._id || user.id,
    subscriptionPlanId: plan._id || plan.id,
    subscriptionId: subscription._id || subscription.id,
    customerId: subscription.customer,
    dedupeKey: `${kind}:${subscription.stripeAccountId}:${subscription.stripeSubscriptionId}:${kind === "cancellation_scheduled" ? subscription.currentPeriodEnd?.toISOString?.() || subscription.currentPeriodEnd || "unknown" : "once"}`,
    kind,
    to: subscription.customerEmail,
    recipientName: subscription.customerName,
    subject: content.title,
    message: content.title,
    html: layout({
      ...content,
      buttonLabel: undefined,
      buttonUrl: undefined,
    }),
  });
};

export const sendCustomerManagementEmail = ({
  user,
  plan,
  subscription,
  token,
}) => {
  if (!subscription.customerEmail) return null;
  const managementUrl = `${env.clientUrl}/manage-subscription#token=${encodeURIComponent(token)}`;
  return deliver({
    userId: user._id || user.id,
    subscriptionPlanId: plan._id || plan.id,
    subscriptionId: subscription._id || subscription.id,
    customerId: subscription.customer,
    dedupeKey: `management:${subscription.stripeAccountId}:${subscription.stripeSubscriptionId}:initial`,
    kind: "customer_management",
    to: subscription.customerEmail,
    recipientName: subscription.customerName,
    subject: `Manage your ${plan.name} subscription`,
    message: "Use this private, time-limited link to manage your subscription.",
    html: layout({
      eyebrow: "Private management link",
      title: `Manage ${plan.name}`,
      body:
        "<p>Use the private link below to open Stripe’s secure customer portal.</p><p>For your security, this link expires shortly and works only once.</p>",
      buttonLabel: "Manage subscription",
      buttonUrl: managementUrl,
      footer: "Do not forward this private link. Request a new one from the business if it expires.",
    }),
  });
};
