import { Customer } from "../models/Customer.js";
import { CustomerStripeIdentity } from "../models/CustomerStripeIdentity.js";
import { EmailLog } from "../models/EmailLog.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { Transaction } from "../models/Transaction.js";
import { StripeAccount } from "../models/StripeAccount.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";
import { normalizeCustomerEmail } from "../services/customer.service.js";

export const createCustomer = async (req, res) => {
  const user = req.user._id;
  const stripeAccount = await StripeAccount.findOne({ user }).lean();
  if (!stripeAccount) {
    throw new AppError(
      "Connect Stripe before adding customers",
      409,
      "STRIPE_NOT_CONNECTED"
    );
  }
  const normalizedEmail = normalizeCustomerEmail(req.body.email);
  const existing = await Customer.findOne({
    user,
    stripeAccountId: stripeAccount.stripeAccountId,
    normalizedEmail,
    status: "active",
  }).lean();
  if (existing) {
    throw new AppError(
      "A customer with this email already exists",
      409,
      "CUSTOMER_EMAIL_EXISTS",
      { customerId: existing._id }
    );
  }
  const now = new Date();
  const customer = await Customer.create({
    user,
    stripeAccountId: stripeAccount.stripeAccountId,
    name: req.body.name,
    normalizedName: req.body.name.toLowerCase(),
    email: normalizedEmail,
    normalizedEmail,
    phone: req.body.phone || undefined,
    sourceTypes: ["manual"],
    firstSeenAt: now,
    lastSeenAt: now,
  });
  res.status(201).json({
    success: true,
    message: "Customer created",
    data: { customer },
  });
};

const ownedCustomer = async (user, id) => {
  const customer = await Customer.findOne({ _id: id, user }).lean();
  if (!customer) throw new AppError("Customer not found", 404, "NOT_FOUND");
  return customer;
};

const summarizeCustomers = async (user, customerIds) => {
  if (!customerIds.length) return new Map();
  const [oneTime, recurring, activeSubscriptions] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          user,
          customer: { $in: customerIds },
          status: { $in: ["succeeded", "partially_refunded", "refunded"] },
        },
      },
      {
        $group: {
          _id: { customer: "$customer", currency: "$currency" },
          amount: {
            $sum: {
              $max: [
                0,
                { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] },
              ],
            },
          },
          count: { $sum: 1 },
          lastPaymentAt: { $max: { $ifNull: ["$paidAt", "$createdAt"] } },
        },
      },
    ]),
    SubscriptionInvoice.aggregate([
      {
        $match: {
          user,
          customer: { $in: customerIds },
          invoiceStatus: "paid",
          paymentStatus: "succeeded",
        },
      },
      {
        $group: {
          _id: { customer: "$customer", currency: "$currency" },
          amount: { $sum: "$amountPaid" },
          count: { $sum: 1 },
          lastPaymentAt: { $max: { $ifNull: ["$paidAt", "$createdAt"] } },
        },
      },
    ]),
    Subscription.aggregate([
      { $match: { user, customer: { $in: customerIds }, status: "active" } },
      { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]),
  ]);
  const summaries = new Map(
    customerIds.map((id) => [
      String(id),
      {
        oneTimeTotals: [],
        recurringTotals: [],
        oneTimePaymentCount: 0,
        recurringPaymentCount: 0,
        activeSubscriptionCount: 0,
        totalPaymentActivityCount: 0,
        lastPaymentAt: null,
      },
    ])
  );
  const addTotals = (items, key, countKey) => {
    for (const item of items) {
      const summary = summaries.get(String(item._id.customer));
      if (!summary) continue;
      summary[key].push({
        currency: item._id.currency,
        amount: item.amount,
        count: item.count,
      });
      summary[countKey] += item.count;
      summary.totalPaymentActivityCount += item.count;
      if (
        item.lastPaymentAt &&
        (!summary.lastPaymentAt || item.lastPaymentAt > summary.lastPaymentAt)
      ) {
        summary.lastPaymentAt = item.lastPaymentAt;
      }
    }
  };
  addTotals(oneTime, "oneTimeTotals", "oneTimePaymentCount");
  addTotals(recurring, "recurringTotals", "recurringPaymentCount");
  for (const item of activeSubscriptions) {
    const summary = summaries.get(String(item._id));
    if (summary) summary.activeSubscriptionCount = item.count;
  }
  return summaries;
};

const filteredCustomerIds = async ({ user, hasActiveSubscription, hasFailedPayment }) => {
  let ids;
  if (hasActiveSubscription) {
    ids = new Set(
      (await Subscription.distinct("customer", { user, status: "active" })).map(String)
    );
  }
  if (hasFailedPayment) {
    const [transactions, invoices] = await Promise.all([
      Transaction.distinct("customer", { user, status: "failed", customer: { $ne: null } }),
      SubscriptionInvoice.distinct("customer", {
        user,
        paymentStatus: { $in: ["failed", "action_required"] },
      }),
    ]);
    const failed = new Set([...transactions, ...invoices].map(String));
    ids = ids ? new Set([...ids].filter((id) => failed.has(id))) : failed;
  }
  return ids ? [...ids] : undefined;
};

export const listCustomers = async (req, res) => {
  const {
    page,
    limit,
    search: searchText,
    source,
    hasActiveSubscription,
    hasFailedPayment,
    createdFrom,
    createdTo,
    activityFrom,
    activityTo,
  } = req.validated.query;
  const user = req.user._id;
  const filter = { user, status: "active" };
  if (source) filter.sourceTypes = source;
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    filter.$or = [{ normalizedName: search }, { normalizedEmail: search }];
  }
  if (createdFrom || createdTo) {
    filter.createdAt = {};
    if (createdFrom) filter.createdAt.$gte = new Date(`${createdFrom}T00:00:00.000Z`);
    if (createdTo) filter.createdAt.$lte = new Date(`${createdTo}T23:59:59.999Z`);
  }
  if (activityFrom || activityTo) {
    filter.lastSeenAt = {};
    if (activityFrom) filter.lastSeenAt.$gte = new Date(`${activityFrom}T00:00:00.000Z`);
    if (activityTo) filter.lastSeenAt.$lte = new Date(`${activityTo}T23:59:59.999Z`);
  }
  const constrainedIds = await filteredCustomerIds({
    user,
    hasActiveSubscription,
    hasFailedPayment,
  });
  if (constrainedIds) filter._id = { $in: constrainedIds };

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ lastSeenAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);
  const summaries = await summarizeCustomers(
    user,
    customers.map((customer) => customer._id)
  );
  res.json({
    success: true,
    data: {
      items: customers.map((customer) => ({
        ...customer,
        ...summaries.get(String(customer._id)),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
};

export const getCustomer = async (req, res) => {
  const user = req.user._id;
  const customer = await ownedCustomer(user, req.validated.params.id);
  const [identities, summaries, latestActivity] = await Promise.all([
    CustomerStripeIdentity.find({ user, customer: customer._id })
      .select("stripeAccountId stripeCustomerId source firstSeenAt lastSeenAt")
      .sort({ lastSeenAt: -1 })
      .lean(),
    summarizeCustomers(user, [customer._id]),
    Promise.all([
      Transaction.findOne({ user, customer: customer._id }).sort({ createdAt: -1 }).lean(),
      Subscription.findOne({ user, customer: customer._id }).sort({ createdAt: -1 }).lean(),
      SubscriptionInvoice.findOne({ user, customer: customer._id }).sort({ createdAt: -1 }).lean(),
      EmailLog.findOne({ user, customer: customer._id }).sort({ createdAt: -1 }).lean(),
    ]),
  ]);
  res.json({
    success: true,
    data: {
      customer,
      identities,
      summary: summaries.get(String(customer._id)),
      latestActivity: latestActivity.filter(Boolean),
    },
  });
};

const pagedCustomerRecords = async ({ req, Model, populate }) => {
  const user = req.user._id;
  const customer = await ownedCustomer(user, req.validated.params.id);
  const { page, limit } = req.validated.query;
  let query = Model.find({ user, customer: customer._id })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  for (const args of populate) query = query.populate(...args);
  const [items, total] = await Promise.all([
    query.lean(),
    Model.countDocuments({ user, customer: customer._id }),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getCustomerTransactions = async (req, res) =>
  res.json({
    success: true,
    data: await pagedCustomerRecords({
      req,
      Model: Transaction,
      populate: [["paymentLink", "title internalReference"]],
    }),
  });

export const getCustomerSubscriptions = async (req, res) =>
  res.json({
    success: true,
    data: await pagedCustomerRecords({
      req,
      Model: Subscription,
      populate: [["plan", "name internalReference"]],
    }),
  });

export const getCustomerInvoices = async (req, res) =>
  res.json({
    success: true,
    data: await pagedCustomerRecords({
      req,
      Model: SubscriptionInvoice,
      populate: [["plan", "name"], ["subscription", "stripeSubscriptionId"]],
    }),
  });

export const getCustomerActivity = async (req, res) => {
  const user = req.user._id;
  const customer = await ownedCustomer(user, req.validated.params.id);
  const [transactions, subscriptions, invoices, emails] = await Promise.all([
    Transaction.find({ user, customer: customer._id })
      .populate("paymentLink", "title")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Subscription.find({ user, customer: customer._id })
      .populate("plan", "name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    SubscriptionInvoice.find({ user, customer: customer._id })
      .populate("plan", "name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    EmailLog.find({ user, customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);
  const activity = [
    ...transactions.map((item) => ({
      type: item.refundedAmount > 0 ? "one_time_refund" : "one_time_payment",
      status: item.status,
      occurredAt: item.refundedAt || item.paidAt || item.createdAt,
      amount: item.amount,
      refundedAmount: item.refundedAmount,
      currency: item.currency,
      title: item.paymentLink?.title,
      resourceId: item._id,
    })),
    ...subscriptions.map((item) => ({
      type: item.status === "canceled"
        ? "subscription_canceled"
        : item.cancelAtPeriodEnd
          ? "cancellation_scheduled"
          : "subscription_started",
      status: item.status,
      occurredAt: item.canceledAt || item.createdAt,
      title: item.plan?.name,
      resourceId: item._id,
    })),
    ...invoices.map((item) => ({
      type: item.paymentStatus === "succeeded"
        ? "recurring_payment"
        : "recurring_payment_failed",
      status: item.paymentStatus,
      occurredAt: item.paidAt || item.paymentAttemptedAt || item.createdAt,
      amount: item.amountPaid || item.amountDue,
      currency: item.currency,
      title: item.plan?.name,
      resourceId: item._id,
    })),
    ...emails.map((item) => ({
      type: "email",
      status: item.status,
      occurredAt: item.sentAt || item.createdAt,
      title: item.subject,
      kind: item.kind,
      resourceId: item._id,
    })),
  ]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 200);
  res.json({ success: true, data: { items: activity } });
};
