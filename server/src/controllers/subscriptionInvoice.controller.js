import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";

export const listSubscriptionInvoices = async (req, res) => {
  const {
    page,
    limit,
    search: searchText,
    subscription,
    plan,
    invoiceStatus,
    paymentStatus,
    from,
    to,
  } = req.validated.query;
  const filter = { user: req.user.id };
  if (subscription) filter.subscription = subscription;
  if (plan) filter.plan = plan;
  if (invoiceStatus) filter.invoiceStatus = invoiceStatus;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    filter.paymentAttemptedAt = {};
    if (from) filter.paymentAttemptedAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.paymentAttemptedAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    filter.$or = [
      { invoiceNumber: search },
      { stripeInvoiceId: search },
      { stripeCustomerId: search },
    ];
  }

  const [items, total] = await Promise.all([
    SubscriptionInvoice.find(filter)
      .populate("plan", "name")
      .populate("subscription", "customerName customerEmail")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SubscriptionInvoice.countDocuments(filter),
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

export const getSubscriptionInvoice = async (req, res) => {
  const invoice = await SubscriptionInvoice.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  })
    .populate("plan", "name billingInterval")
    .populate("subscription", "customerName customerEmail status")
    .populate("customer", "name email phone")
    .lean();
  if (!invoice) {
    throw new AppError("Subscription invoice not found", 404, "NOT_FOUND");
  }
  res.json({ success: true, data: { invoice } });
};
