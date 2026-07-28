import { Transaction } from "../models/Transaction.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/security.js";

export const listTransactions = async (req, res) => {
  const {
    page,
    limit,
    search: searchText,
    status,
    paymentLink,
    from,
    to,
  } = req.validated.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;
  if (paymentLink) filter.paymentLink = paymentLink;
  if (from || to) {
    filter.paidAt = {};
    if (from) filter.paidAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      filter.paidAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
  }
  if (searchText) {
    const search = new RegExp(escapeRegex(searchText), "i");
    filter.$or = [
      { customerEmail: search },
      { stripePaymentIntentId: search },
      { stripeCheckoutSessionId: search },
    ];
  }
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .populate("paymentLink", "title internalReference")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
};

export const getTransaction = async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.validated.params.id,
    user: req.user.id,
  })
    .populate("paymentLink", "title publicUrl internalReference")
    .populate("customer", "name email")
    .lean();
  if (!transaction) throw new AppError("Transaction not found", 404, "NOT_FOUND");
  res.json({ success: true, data: { transaction } });
};
