import { Customer } from "../models/Customer.js";
import { CustomerStripeIdentity } from "../models/CustomerStripeIdentity.js";
import { EmailLog } from "../models/EmailLog.js";
import { SUBSCRIPTION_EMAIL_TYPES } from "../../../shared/domain.js";

const customerEmailKinds = ["payment_link", ...SUBSCRIPTION_EMAIL_TYPES];

export const normalizeCustomerEmail = (email) =>
  typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : undefined;

const safeCustomerUpdate = ({ name, email, phone, source, seenAt, stripeEventCreatedAt }) => {
  const normalizedEmail = normalizeCustomerEmail(email);
  return {
    $set: {
      ...(name?.trim()
        ? { name: name.trim(), normalizedName: name.trim().toLowerCase() }
        : {}),
      ...(normalizedEmail
        ? { email: normalizedEmail, normalizedEmail }
        : {}),
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
      lastSeenAt: seenAt,
      ...(stripeEventCreatedAt
        ? { lastStripeEventCreatedAt: stripeEventCreatedAt }
        : {}),
    },
    $addToSet: { sourceTypes: source },
  };
};

const attachMatchingEmails = async ({ user, customer, normalizedEmail }) => {
  if (!normalizedEmail) return;
  await EmailLog.updateMany(
    {
      user,
      customer: null,
      kind: { $in: customerEmailKinds },
      recipientEmail: normalizedEmail,
    },
    {
      $set: {
        customer: customer._id,
        customerEmailSnapshot: normalizedEmail,
      },
    }
  );
};

export const resolveCustomer = async ({
  user,
  stripeAccountId,
  stripeCustomerId,
  name,
  email,
  phone,
  source,
  seenAt = new Date(),
  stripeEventCreatedAt,
}) => {
  const normalizedEmail = normalizeCustomerEmail(email);
  if (!stripeCustomerId && !normalizedEmail && !phone?.trim()) {
    return null;
  }

  if (stripeCustomerId) {
    const identity = await CustomerStripeIdentity.findOne({
      stripeAccountId,
      stripeCustomerId,
    });
    if (identity) {
      if (String(identity.user) !== String(user)) {
        throw new Error("Stripe customer identity belongs to another platform user");
      }
      let customer = await Customer.findById(identity.customer);
      const stale =
        stripeEventCreatedAt &&
        customer?.lastStripeEventCreatedAt &&
        customer.lastStripeEventCreatedAt > stripeEventCreatedAt;
      if (!stale) {
        customer = await Customer.findByIdAndUpdate(
          identity.customer,
          safeCustomerUpdate({
            name,
            email,
            phone,
            source,
            seenAt,
            stripeEventCreatedAt,
          }),
          { new: true, runValidators: true }
        );
      }
      if (!identity.lastSeenAt || identity.lastSeenAt < seenAt) {
        identity.lastSeenAt = seenAt;
        await identity.save();
      }
      await attachMatchingEmails({ user, customer, normalizedEmail });
      return customer;
    }
  }

  let customer;
  if (normalizedEmail) {
    const matches = await Customer.find({
      user,
      stripeAccountId,
      normalizedEmail,
      status: "active",
    }).limit(2);
    if (matches.length === 1) {
      customer = matches[0];
    }
  }

  if (!customer) {
    customer = await Customer.create({
      user,
      stripeAccountId,
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(name?.trim() ? { normalizedName: name.trim().toLowerCase() } : {}),
      ...(normalizedEmail ? { email: normalizedEmail, normalizedEmail } : {}),
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
      sourceTypes: [source],
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      ...(stripeEventCreatedAt ? { lastStripeEventCreatedAt: stripeEventCreatedAt } : {}),
    });
  } else {
    const stale =
      stripeEventCreatedAt &&
      customer.lastStripeEventCreatedAt &&
      customer.lastStripeEventCreatedAt > stripeEventCreatedAt;
    if (!stale) {
      customer = await Customer.findByIdAndUpdate(
        customer._id,
        safeCustomerUpdate({
          name,
          email,
          phone,
          source,
          seenAt,
          stripeEventCreatedAt,
        }),
        { new: true, runValidators: true }
      );
    }
  }

  if (stripeCustomerId) {
    try {
      await CustomerStripeIdentity.create({
        user,
        customer: customer._id,
        stripeAccountId,
        stripeCustomerId,
        source,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await CustomerStripeIdentity.findOne({
        stripeAccountId,
        stripeCustomerId,
      });
      if (!existing || String(existing.user) !== String(user)) throw error;
      if (String(customer._id) !== String(existing.customer)) {
        await Customer.updateOne(
          { _id: customer._id, status: "active" },
          { $set: { status: "merged", mergedInto: existing.customer } }
        );
      }
      customer = await Customer.findById(existing.customer);
    }
  }

  await attachMatchingEmails({ user, customer, normalizedEmail });
  return customer;
};
