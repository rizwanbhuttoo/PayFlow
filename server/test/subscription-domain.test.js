import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveLocalSubscriptionStatus,
  getInvoicePaymentIntentId,
  getInvoiceSubscriptionId,
  getStripeSubscriptionPeriod,
  isCompletedSubscriptionCheckout,
  mapInvoicePaymentStatus,
  mapStripeSubscriptionStatus,
} from "../src/services/subscriptionWebhook.service.js";
import {
  cancellationSchema,
  subscriptionPlanSchema,
} from "../src/validation/schemas.js";

test("maps Stripe subscription statuses into the supported local lifecycle", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "incomplete_expired");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "active");
  assert.equal(mapStripeSubscriptionStatus("paused"), "unpaid");
  assert.equal(
    deriveLocalSubscriptionStatus({
      status: "active",
      latest_invoice: {
        billing_reason: "subscription_create",
        status: "open",
        paid: false,
      },
    }),
    "incomplete"
  );
});

test("reads billing periods from current Stripe subscription-item fields", () => {
  const period = getStripeSubscriptionPeriod({
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
  });
  assert.equal(period.start.toISOString(), "2023-11-14T22:13:20.000Z");
  assert.equal(period.end.toISOString(), "2023-12-14T22:13:20.000Z");
});

test("only completed Stripe subscription Checkouts are eligible for callback reconciliation", () => {
  assert.equal(
    isCompletedSubscriptionCheckout({
      mode: "subscription",
      status: "complete",
      subscription: "sub_123",
    }),
    true
  );
  assert.equal(
    isCompletedSubscriptionCheckout({
      mode: "subscription",
      status: "open",
      subscription: null,
    }),
    false
  );
  assert.equal(
    isCompletedSubscriptionCheckout({
      mode: "payment",
      status: "complete",
      subscription: "sub_123",
    }),
    false
  );
});

test("resolves modern Stripe invoice subscription and payment intent references", () => {
  const invoice = {
    parent: {
      subscription_details: { subscription: "sub_123" },
    },
    payments: {
      data: [
        {
          payment: { payment_intent: "pi_123" },
        },
      ],
    },
  };
  assert.equal(getInvoiceSubscriptionId(invoice), "sub_123");
  assert.equal(getInvoicePaymentIntentId(invoice), "pi_123");
});

test("derives invoice payment outcomes without counting failed invoices as paid", () => {
  assert.equal(
    mapInvoicePaymentStatus({ status: "paid", paid: true }, "invoice.paid"),
    "succeeded"
  );
  assert.equal(
    mapInvoicePaymentStatus(
      { status: "open", paid: false },
      "invoice.payment_failed"
    ),
    "failed"
  );
  assert.equal(
    mapInvoicePaymentStatus(
      { status: "open", paid: false },
      "invoice.payment_action_required"
    ),
    "action_required"
  );
  assert.equal(
    mapInvoicePaymentStatus({
      status: "open",
      paid: false,
      attempted: true,
      attempt_count: 1,
      amount_remaining: 2500,
    }),
    "failed"
  );
});

test("validates fixed monthly and yearly plan boundaries", () => {
  const monthly = subscriptionPlanSchema.parse({
    name: "Support",
    amount: 2500,
    currency: "USD",
    billingInterval: "monthly",
  });
  assert.equal(monthly.currency, "usd");
  assert.equal(monthly.amount, 2500);
  assert.throws(() =>
    subscriptionPlanSchema.parse({
      name: "Invalid",
      amount: 0,
      currency: "usd",
      billingInterval: "weekly",
    })
  );
});

test("requires explicit cancellation confirmation", () => {
  assert.throws(() =>
    cancellationSchema.parse({
      type: "immediate",
      reason: "",
      confirmed: false,
    })
  );
  assert.equal(
    cancellationSchema.parse({
      type: "period_end",
      reason: "",
      confirmed: true,
    }).type,
    "period_end"
  );
});
