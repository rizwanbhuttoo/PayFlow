import { Transaction } from "../models/Transaction.js";
import { PaymentLink } from "../models/PaymentLink.js";
import { StripeAccount } from "../models/StripeAccount.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { Customer } from "../models/Customer.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { EmailLog } from "../models/EmailLog.js";

const dashboardCache = new Map();
const CACHE_TTL_MS = 30_000;

const fromCache = (user) => {
  const item = dashboardCache.get(String(user));
  if (item && item.expiresAt > Date.now()) return item.value;
  dashboardCache.delete(String(user));
  return null;
};

const toCache = (user, value) => {
  dashboardCache.set(String(user), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
};

export const getDashboardSummary = async (req, res) => {
  const user = req.user._id;
  const cached = fromCache(user);
  if (cached) return res.json({ success: true, data: cached });

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const [
    paymentMetrics,
    linkMetrics,
    subscriptionMetrics,
    recurringRevenue,
    recurringEstimates,
    stripeAccount,
    totalCustomers,
    newCustomers,
    activeSubscriptionCustomers,
    failedCustomers,
  ] = await Promise.all([
    Transaction.aggregate([
      { $match: { user } },
      {
        $facet: {
          totals: [
            { $match: { status: { $in: ["succeeded", "partially_refunded", "refunded"] } } },
            {
              $group: {
                _id: "$currency",
                amount: {
                  $sum: {
                    $max: [0, { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] }],
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          failed: [{ $match: { status: "failed" } }, { $count: "count" }],
        },
      },
    ]),
    PaymentLink.aggregate([
      { $match: { user } },
      {
        $group: {
          _id: null,
          totalLinks: { $sum: 1 },
          activeLinks: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        },
      },
    ]),
    Subscription.aggregate([
      { $match: { user } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    SubscriptionInvoice.aggregate([
      { $match: { user, invoiceStatus: "paid", paymentStatus: "succeeded" } },
      { $group: { _id: "$currency", amount: { $sum: "$amountPaid" }, count: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $match: { user, status: "active" } },
      {
        $group: {
          _id: { currency: "$currency", billingInterval: "$billingInterval" },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    StripeAccount.findOne({ user }).lean(),
    Customer.countDocuments({ user, status: "active" }),
    Customer.countDocuments({ user, status: "active", createdAt: { $gte: periodStart } }),
    Subscription.distinct("customer", { user, status: "active" }),
    Promise.all([
      Transaction.distinct("customer", { user, status: "failed", customer: { $ne: null } }),
      SubscriptionInvoice.distinct("customer", {
        user,
        paymentStatus: { $in: ["failed", "action_required"] },
      }),
    ]),
  ]);
  const totals = paymentMetrics[0]?.totals || [];
  const statusCounts = Object.fromEntries(
    subscriptionMetrics.map((item) => [item._id, item.count])
  );
  const customerIdsWithActivity = await Promise.all([
    Transaction.distinct("customer", {
      user,
      customer: { $ne: null },
      createdAt: { $lt: periodStart },
    }),
    Transaction.distinct("customer", {
      user,
      customer: { $ne: null },
      createdAt: { $gte: periodStart },
    }),
  ]);
  const previous = new Set(customerIdsWithActivity[0].map(String));
  const returningCustomers = customerIdsWithActivity[1].filter((id) =>
    previous.has(String(id))
  ).length;
  const failedSet = new Set(failedCustomers.flat().filter(Boolean).map(String));
  const data = {
    summary: {
      totals,
      successfulPayments: totals.reduce((sum, item) => sum + item.count, 0),
      failedPayments: paymentMetrics[0]?.failed[0]?.count || 0,
      activeLinks: linkMetrics[0]?.activeLinks || 0,
      totalLinks: linkMetrics[0]?.totalLinks || 0,
    },
    stripeAccount,
    subscriptionSummary: {
      activeSubscriptions: statusCounts.active || 0,
      pastDueSubscriptions: statusCounts.past_due || 0,
      canceledSubscriptions: statusCounts.canceled || 0,
      failedRecurringPayments: failedCustomers[1].length,
      recurringRevenue,
      monthlyEstimates: recurringEstimates
        .filter((item) => item._id.billingInterval === "monthly")
        .map((item) => ({ currency: item._id.currency, amount: item.amount, count: item.count })),
      yearlyEstimates: recurringEstimates
        .filter((item) => item._id.billingInterval === "yearly")
        .map((item) => ({ currency: item._id.currency, amount: item.amount, count: item.count })),
    },
    customerSummary: {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customersWithFailedPayments: failedSet.size,
      customersWithActiveSubscriptions: activeSubscriptionCustomers.filter(Boolean).length,
    },
  };
  return res.json({ success: true, data: toCache(user, data) });
};

export const getDashboardRecent = async (req, res) => {
  const user = req.user._id;
  const [recentTransactions, recentLinks, recentSubscriptions, recentRecurringPayments] =
    await Promise.all([
      Transaction.find({ user }).populate("paymentLink", "title").sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
      PaymentLink.find({ user }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
      Subscription.find({ user }).populate("plan", "name").sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
      SubscriptionInvoice.find({ user, paymentStatus: "succeeded" })
        .populate("plan", "name")
        .populate("subscription", "customerEmail customerName")
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
    ]);
  res.json({
    success: true,
    data: { recentTransactions, recentLinks, recentSubscriptions, recentRecurringPayments },
  });
};

export const getDashboardAlerts = async (req, res) => {
  const user = req.user._id;
  const [
    failedRecurringPayments,
    scheduledCancellations,
    webhookDeadLetters,
    failedEmails,
  ] = await Promise.all([
    SubscriptionInvoice.find({ user, paymentStatus: { $in: ["failed", "action_required"] } })
      .populate("plan", "name")
      .populate("subscription", "customerEmail customerName")
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .lean(),
    Subscription.find({ user, cancelAtPeriodEnd: true, status: { $ne: "canceled" } })
      .populate("plan", "name")
      .sort({ currentPeriodEnd: 1, _id: 1 })
      .limit(5)
      .lean(),
    WebhookEvent.countDocuments({ user, status: "dead_letter" }),
    EmailLog.countDocuments({ user, status: { $in: ["failed", "dead_letter"] } }),
  ]);
  res.json({
    success: true,
    data: {
      failedRecurringPayments,
      scheduledCancellations,
      operationalAlerts: { webhookDeadLetters, failedEmails },
    },
  });
};

export const getDashboard = async (req, res) => {
  const user = req.user._id;
  const [
    totals,
    failedPayments,
    activeLinks,
    totalLinks,
    recentTransactions,
    recentLinks,
    stripeAccount,
    subscriptionCounts,
    recurringRevenue,
    recurringEstimates,
    recentSubscriptions,
    recentRecurringPayments,
    failedRecurringPayments,
    scheduledCancellations,
    failedRecurringPaymentCount,
  ] =
    await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user,
            status: { $in: ["succeeded", "partially_refunded", "refunded"] },
          },
        },
        {
          $group: {
            _id: "$currency",
            amount: {
              $sum: {
                $max: [
                  0,
                  {
                    $subtract: [
                      "$amount",
                      { $ifNull: ["$refundedAmount", 0] },
                    ],
                  },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.countDocuments({ user, status: "failed" }),
      PaymentLink.countDocuments({ user, status: "active" }),
      PaymentLink.countDocuments({ user }),
      Transaction.find({ user })
        .populate("paymentLink", "title")
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
      PaymentLink.find({ user })
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
      StripeAccount.findOne({ user }).lean(),
      Subscription.aggregate([
        { $match: { user } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SubscriptionInvoice.aggregate([
        {
          $match: {
            user,
            invoiceStatus: "paid",
            paymentStatus: "succeeded",
          },
        },
        {
          $group: {
            _id: "$currency",
            amount: { $sum: "$amountPaid" },
            count: { $sum: 1 },
          },
        },
      ]),
      Subscription.aggregate([
        { $match: { user, status: "active" } },
        {
          $group: {
            _id: {
              currency: "$currency",
              billingInterval: "$billingInterval",
            },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Subscription.find({ user })
        .populate("plan", "name")
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
      SubscriptionInvoice.find({ user, paymentStatus: "succeeded" })
        .populate("plan", "name")
        .populate("subscription", "customerEmail customerName")
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
      SubscriptionInvoice.find({
        user,
        paymentStatus: { $in: ["failed", "action_required"] },
      })
        .populate("plan", "name")
        .populate("subscription", "customerEmail customerName")
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
      Subscription.find({
        user,
        cancelAtPeriodEnd: true,
        status: { $ne: "canceled" },
      })
        .populate("plan", "name")
        .sort({ currentPeriodEnd: 1, _id: 1 })
        .limit(5)
        .lean(),
      SubscriptionInvoice.countDocuments({
        user,
        paymentStatus: { $in: ["failed", "action_required"] },
      }),
    ]);
  const countByStatus = Object.fromEntries(
    subscriptionCounts.map((item) => [item._id, item.count])
  );
  res.json({
    success: true,
    data: {
      summary: {
        totals,
        successfulPayments: totals.reduce((sum, item) => sum + item.count, 0),
        failedPayments,
        activeLinks,
        totalLinks,
      },
      recentTransactions,
      recentLinks,
      stripeAccount,
      subscriptionSummary: {
        activeSubscriptions: countByStatus.active || 0,
        pastDueSubscriptions: countByStatus.past_due || 0,
        canceledSubscriptions: countByStatus.canceled || 0,
        failedRecurringPayments: failedRecurringPaymentCount,
        recurringRevenue,
        monthlyEstimates: recurringEstimates
          .filter((item) => item._id.billingInterval === "monthly")
          .map((item) => ({
            currency: item._id.currency,
            amount: item.amount,
            count: item.count,
          })),
        yearlyEstimates: recurringEstimates
          .filter((item) => item._id.billingInterval === "yearly")
          .map((item) => ({
            currency: item._id.currency,
            amount: item.amount,
            count: item.count,
          })),
      },
      recentSubscriptions,
      recentRecurringPayments,
      failedRecurringPayments,
      scheduledCancellations,
    },
  });
};
