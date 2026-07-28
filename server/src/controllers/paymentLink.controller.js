import { PaymentLink } from "../models/PaymentLink.js";
import { Transaction } from "../models/Transaction.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";
import { createStripePaymentLink, deactivateStripePaymentLink } from "../services/stripe.service.js";
import { sendPaymentLinkEmail } from "../services/email.service.js";
import { requireIdempotencyKey } from "../services/idempotency.service.js";

export const createPaymentLink = async (req, res) => {
  const link = await createStripePaymentLink(
    req.user.id,
    req.body,
    requireIdempotencyKey(req)
  );
  res.status(201).json({ success: true, message: "Payment request created", data: { link } });
};

export const listPaymentLinks = async (req, res) => {
  const { page, limit, search: searchText, status } = req.validated.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    filter.$or = [{ title: search }, { internalReference: search }];
  }
  const [items, total] = await Promise.all([
    PaymentLink.find(filter)
      .populate("customer", "name email phone")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PaymentLink.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
};

export const getPaymentLink = async (req, res) => {
  const link = await PaymentLink.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  })
    .populate("customer", "name email phone")
    .lean();
  if (!link) throw new AppError("Payment link not found", 404, "NOT_FOUND");
  res.json({ success: true, data: { link } });
};

export const deactivatePaymentLink = async (req, res) => {
  const link = await PaymentLink.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  });
  if (!link) throw new AppError("Payment link not found", 404, "NOT_FOUND");
  if (link.status !== "active") throw new AppError("This payment link is already inactive", 409, "LINK_INACTIVE");
  await deactivateStripePaymentLink(link);
  res.json({ success: true, message: "Payment link deactivated", data: { link } });
};

export const emailPaymentLink = async (req, res) => {
  const link = await PaymentLink.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  })
    .populate("customer", "name email phone")
    .lean();
  if (!link) throw new AppError("Payment link not found", 404, "NOT_FOUND");
  if (link.status !== "active") throw new AppError("Only active payment links can be sent", 409, "LINK_INACTIVE");
  if (!link.customer) {
    throw new AppError(
      "Legacy generic links cannot be emailed in customer-first mode",
      409,
      "CUSTOMER_REQUIRED"
    );
  }
  const log = await sendPaymentLinkEmail({
    user: req.user,
    paymentLink: link,
    customer: link.customer,
    input: req.body,
  });
  res.status(202).json({ success: true, message: "Payment request queued", data: { email: log } });
};

export const getLinkTransactions = async (req, res) => {
  const { page, limit } = req.validated.query;
  const link = await PaymentLink.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  }).lean();
  if (!link) throw new AppError("Payment link not found", 404, "NOT_FOUND");
  const filter = { user: req.user.id, paymentLink: link._id };
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
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
