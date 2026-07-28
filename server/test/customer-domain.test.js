import test from "node:test";
import assert from "node:assert/strict";
import { Customer } from "../src/models/Customer.js";
import { CustomerStripeIdentity } from "../src/models/CustomerStripeIdentity.js";
import { EmailLog } from "../src/models/EmailLog.js";
import {
  normalizeCustomerEmail,
  resolveCustomer,
} from "../src/services/customer.service.js";
import { getCustomer } from "../src/controllers/customer.controller.js";
import { sendSubscriptionPlanEmail } from "../src/services/email.service.js";
import {
  customerCreateSchema,
  paymentLinkSchema,
  subscriptionPlanCheckoutSchema,
  subscriptionPlanEmailSchema,
} from "../src/validation/schemas.js";

test("customer email normalization is scoped input, not a global identity", () => {
  assert.equal(normalizeCustomerEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(normalizeCustomerEmail(""), undefined);
});

test("active customer emails are unique only within an owner and connected account", () => {
  const emailIndex = Customer.schema.indexes().find(
    ([fields]) =>
      fields.user === 1 &&
      fields.stripeAccountId === 1 &&
      fields.normalizedEmail === 1
  );
  assert.equal(emailIndex?.[1].unique, true);
  assert.deepEqual(emailIndex?.[1].partialFilterExpression, {
    normalizedEmail: { $type: "string" },
    status: "active",
  });
});

test("customer-first request schemas require a saved customer", () => {
  const customerId = "507f1f77bcf86cd799439088";
  const customer = customerCreateSchema.parse({
    name: "Alex Morgan",
    email: " ALEX@Example.com ",
    phone: "",
  });
  assert.equal(customer.email, "alex@example.com");

  const request = paymentLinkSchema.parse({
    customer: customerId,
    title: "Design deposit",
    amount: 25000,
    currency: "USD",
  });
  assert.equal(request.customer, customerId);
  assert.throws(() =>
    paymentLinkSchema.parse({
      title: "Missing customer",
      amount: 25000,
      currency: "usd",
    })
  );

  const checkout = subscriptionPlanCheckoutSchema.parse({
    customer: customerId,
  });
  assert.equal(checkout.customer, customerId);

  const invitation = subscriptionPlanEmailSchema.parse({
    customer: customerId,
    checkoutSessionId: "cs_test_customer_checkout_123",
    subject: "Your subscription",
    message: "",
  });
  assert.equal(invitation.customer, customerId);
  assert.throws(() =>
    subscriptionPlanEmailSchema.parse({
      customer: customerId,
      recipientEmail: "someone@example.com",
      subject: "Generic invitation",
    })
  );
});

test("a failed optional subscription email can be queued again without recreating checkout", async (t) => {
  const originalFindOne = EmailLog.findOne;
  const originalFindByIdAndUpdate = EmailLog.findByIdAndUpdate;
  t.after(() => {
    EmailLog.findOne = originalFindOne;
    EmailLog.findByIdAndUpdate = originalFindByIdAndUpdate;
  });

  let capturedUpdate;
  EmailLog.findOne = async () => ({
    _id: "507f1f77bcf86cd799439077",
    status: "failed",
  });
  EmailLog.findByIdAndUpdate = async (_id, update) => {
    capturedUpdate = update;
    return { _id, status: update.$set.status };
  };

  await sendSubscriptionPlanEmail({
    user: {
      id: "507f1f77bcf86cd799439011",
      firstName: "PayFlow",
      lastName: "Owner",
    },
    plan: {
      _id: "507f1f77bcf86cd799439022",
      stripeAccountId: "acct_test",
      name: "Support",
      amount: 2500,
      currency: "usd",
      billingInterval: "monthly",
    },
    customer: {
      _id: "507f1f77bcf86cd799439088",
      name: "Alex",
      email: "alex@example.com",
    },
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_retry",
    checkoutSessionId: "cs_test_retry",
    input: { subject: "Subscription invitation", message: "" },
  });

  assert.equal(capturedUpdate.$set.status, "queued");
  assert.equal(capturedUpdate.$set.attempts, 0);
  assert.ok(capturedUpdate.$unset.errorMessage);
});

test("anonymous payments remain unlinked and do not create fake customers", async () => {
  assert.equal(
    await resolveCustomer({
      user: "507f1f77bcf86cd799439011",
      stripeAccountId: "acct_test",
      source: "one_time",
    }),
    null
  );
});

test("Stripe identity is authoritative and cannot cross platform owners", async (t) => {
  const originalIdentityFind = CustomerStripeIdentity.findOne;
  const originalCustomerUpdate = Customer.findByIdAndUpdate;
  const originalEmailUpdate = EmailLog.updateMany;
  t.after(() => {
    CustomerStripeIdentity.findOne = originalIdentityFind;
    Customer.findByIdAndUpdate = originalCustomerUpdate;
    EmailLog.updateMany = originalEmailUpdate;
  });

  CustomerStripeIdentity.findOne = async () => ({
    user: "507f1f77bcf86cd799439099",
    customer: "507f1f77bcf86cd799439088",
    save: async () => {},
  });
  Customer.findByIdAndUpdate = async () => {
    throw new Error("must not update a cross-owner customer");
  };
  EmailLog.updateMany = async () => {};

  await assert.rejects(
    resolveCustomer({
      user: "507f1f77bcf86cd799439011",
      stripeAccountId: "acct_test",
      stripeCustomerId: "cus_test",
      email: "person@example.com",
      source: "one_time",
    }),
    /another platform user/
  );
});

test("email matching is always scoped by platform user and connected account", async (t) => {
  const originalFind = Customer.find;
  const originalCreate = Customer.create;
  const originalEmailUpdate = EmailLog.updateMany;
  t.after(() => {
    Customer.find = originalFind;
    Customer.create = originalCreate;
    EmailLog.updateMany = originalEmailUpdate;
  });
  let capturedFilter;
  Customer.find = (filter) => {
    capturedFilter = filter;
    return { limit: async () => [] };
  };
  Customer.create = async (input) => ({ _id: "507f1f77bcf86cd799439088", ...input });
  EmailLog.updateMany = async () => {};

  await resolveCustomer({
    user: "507f1f77bcf86cd799439011",
    stripeAccountId: "acct_owner_a",
    email: "payer@example.com",
    source: "one_time",
  });
  assert.equal(String(capturedFilter.user), "507f1f77bcf86cd799439011");
  assert.equal(capturedFilter.stripeAccountId, "acct_owner_a");
  assert.equal(capturedFilter.normalizedEmail, "payer@example.com");
});

test("customer detail ownership is enforced in the database query", async (t) => {
  const originalFindOne = Customer.findOne;
  t.after(() => {
    Customer.findOne = originalFindOne;
  });
  let capturedFilter;
  Customer.findOne = (filter) => {
    capturedFilter = filter;
    return { lean: async () => null };
  };
  await assert.rejects(
    getCustomer(
      {
        user: { _id: "507f1f77bcf86cd799439011" },
        validated: { params: { id: "507f1f77bcf86cd799439099" } },
      },
      {}
    ),
    (error) => error.statusCode === 404
  );
  assert.equal(String(capturedFilter.user), "507f1f77bcf86cd799439011");
  assert.equal(capturedFilter._id, "507f1f77bcf86cd799439099");
});
