import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { Customer } from "../models/Customer.js";
import { CustomerStripeIdentity } from "../models/CustomerStripeIdentity.js";
import { EmailLog } from "../models/EmailLog.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { Transaction } from "../models/Transaction.js";
import { PaymentLink } from "../models/PaymentLink.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { resolveCustomer } from "../services/customer.service.js";
import { SUBSCRIPTION_EMAIL_TYPES } from "../../../shared/domain.js";

const counters = {
  legacyCustomers: 0,
  transactionsLinked: 0,
  anonymousTransactions: 0,
  subscriptionsLinked: 0,
  invoicesLinked: 0,
  emailsLinked: 0,
  duplicateCustomersMerged: 0,
  legacyPaymentLinksMarked: 0,
};

const migrateLegacyCustomers = async () => {
  const collection = mongoose.connection.collection("subscriptioncustomers");
  const exists = await mongoose.connection.db
    .listCollections({ name: "subscriptioncustomers" })
    .hasNext();
  if (!exists) return;

  for await (const legacy of collection.find({})) {
    const customer = await resolveCustomer({
      user: legacy.user,
      stripeAccountId: legacy.stripeAccountId,
      stripeCustomerId: legacy.stripeCustomerId,
      name: legacy.name,
      email: legacy.email,
      phone: legacy.phone,
      source: "import",
      seenAt: legacy.updatedAt || legacy.createdAt || new Date(),
    });
    if (!customer) continue;
    counters.legacyCustomers += 1;
    const [subscriptions, invoices, emails] = await Promise.all([
      Subscription.updateMany(
        {
          user: legacy.user,
          stripeAccountId: legacy.stripeAccountId,
          $or: [
            { customer: legacy._id },
            { stripeCustomerId: legacy.stripeCustomerId },
          ],
        },
        { $set: { customer: customer._id } }
      ),
      SubscriptionInvoice.updateMany(
        {
          user: legacy.user,
          stripeAccountId: legacy.stripeAccountId,
          $or: [
            { customer: legacy._id },
            { stripeCustomerId: legacy.stripeCustomerId },
          ],
        },
        { $set: { customer: customer._id } }
      ),
      EmailLog.updateMany(
        {
          user: legacy.user,
          customer: { $exists: false },
          kind: { $in: ["payment_link", ...SUBSCRIPTION_EMAIL_TYPES] },
          recipientEmail: legacy.email?.trim().toLowerCase(),
        },
        {
          $set: {
            customer: customer._id,
            customerEmailSnapshot: legacy.email?.trim().toLowerCase(),
          },
        }
      ),
    ]);
    counters.subscriptionsLinked += subscriptions.modifiedCount;
    counters.invoicesLinked += invoices.modifiedCount;
    counters.emailsLinked += emails.modifiedCount;
  }
};

const backfillTransactions = async () => {
  const cursor = Transaction.find({
    $or: [{ customer: { $exists: false } }, { customer: null }],
  }).cursor();
  for await (const transaction of cursor) {
    const customer = await resolveCustomer({
      user: transaction.user,
      stripeAccountId: transaction.stripeAccountId,
      stripeCustomerId: transaction.stripeCustomerId,
      name: transaction.customerName,
      email: transaction.customerEmail,
      phone: transaction.customerPhone,
      source: "one_time",
      seenAt: transaction.paidAt || transaction.createdAt,
    });
    if (!customer) {
      counters.anonymousTransactions += 1;
      continue;
    }
    transaction.customer = customer._id;
    await transaction.save();
    counters.transactionsLinked += 1;
  }
};

const renameIntendedRecipientField = async () => {
  await mongoose.connection.collection("paymentlinks").updateMany(
    {
      customerEmail: { $exists: true },
      intendedRecipientEmail: { $exists: false },
    },
    { $rename: { customerEmail: "intendedRecipientEmail" } }
  );
};

const markLegacyPaymentLinks = async () => {
  const result = await PaymentLink.updateMany(
    {
      stripePaymentLinkId: { $exists: true, $ne: "" },
      stripeCheckoutSessionId: { $exists: false },
      checkoutType: { $exists: false },
    },
    { $set: { checkoutType: "legacy_payment_link" } }
  );
  counters.legacyPaymentLinksMarked += result.modifiedCount;
};

const mergeDuplicateEmailCustomers = async () => {
  const duplicateGroups = await Customer.aggregate([
    {
      $match: {
        status: "active",
        normalizedEmail: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: {
          user: "$user",
          stripeAccountId: "$stripeAccountId",
          normalizedEmail: "$normalizedEmail",
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const group of duplicateGroups) {
    const customers = await Customer.find({
      user: group._id.user,
      stripeAccountId: group._id.stripeAccountId,
      normalizedEmail: group._id.normalizedEmail,
      status: "active",
    }).sort({ firstSeenAt: 1, createdAt: 1, _id: 1 });
    const [keeper, ...duplicates] = customers;
    if (!keeper || !duplicates.length) continue;

    const duplicateIds = duplicates.map((customer) => customer._id);
    const sourceTypes = new Set(keeper.sourceTypes || []);
    for (const duplicate of duplicates) {
      for (const source of duplicate.sourceTypes || []) sourceTypes.add(source);
      if (!keeper.name && duplicate.name) {
        keeper.name = duplicate.name;
        keeper.normalizedName = duplicate.normalizedName;
      }
      if (!keeper.phone && duplicate.phone) keeper.phone = duplicate.phone;
      if (duplicate.firstSeenAt < keeper.firstSeenAt) {
        keeper.firstSeenAt = duplicate.firstSeenAt;
      }
      if (duplicate.lastSeenAt > keeper.lastSeenAt) {
        keeper.lastSeenAt = duplicate.lastSeenAt;
      }
    }

    keeper.sourceTypes = [...sourceTypes];
    await keeper.save();
    await Promise.all([
      Transaction.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
      PaymentLink.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
      Subscription.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
      SubscriptionInvoice.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
      EmailLog.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
      CustomerStripeIdentity.updateMany(
        { customer: { $in: duplicateIds } },
        { $set: { customer: keeper._id } }
      ),
    ]);
    await Customer.updateMany(
      { _id: { $in: duplicateIds } },
      { $set: { status: "merged", mergedInto: keeper._id } }
    );
    counters.duplicateCustomersMerged += duplicates.length;
  }
};

const verify = async () => {
  const [
    customers,
    identities,
    unlinkedSubscriptions,
    unlinkedInvoices,
    unlinkedTransactions,
    duplicateIdentities,
    duplicateActiveEmails,
  ] = await Promise.all([
    Customer.countDocuments(),
    CustomerStripeIdentity.countDocuments(),
    Subscription.countDocuments({ customer: { $exists: false } }),
    SubscriptionInvoice.countDocuments({ customer: { $exists: false } }),
    Transaction.countDocuments({
      customer: { $exists: false },
      $or: [
        { stripeCustomerId: { $exists: true, $ne: "" } },
        { customerEmail: { $exists: true, $ne: "" } },
      ],
    }),
    CustomerStripeIdentity.aggregate([
      {
        $group: {
          _id: {
            stripeAccountId: "$stripeAccountId",
            stripeCustomerId: "$stripeCustomerId",
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ]),
    Customer.aggregate([
      {
        $match: {
          status: "active",
          normalizedEmail: { $type: "string", $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            user: "$user",
            stripeAccountId: "$stripeAccountId",
            normalizedEmail: "$normalizedEmail",
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ]),
  ]);
  return {
    customers,
    identities,
    unlinkedSubscriptions,
    unlinkedInvoices,
    unlinkedTransactions,
    duplicateStripeIdentities: duplicateIdentities[0]?.count || 0,
    duplicateActiveEmails: duplicateActiveEmails[0]?.count || 0,
  };
};

try {
  await connectDatabase({ autoIndex: false });
  await migrateLegacyCustomers();
  await renameIntendedRecipientField();
  await markLegacyPaymentLinks();
  await backfillTransactions();
  await mergeDuplicateEmailCustomers();
  await Promise.all([
    Customer.syncIndexes(),
    PaymentLink.syncIndexes(),
    SubscriptionPlan.syncIndexes(),
  ]);
  const verification = await verify();
  console.info(JSON.stringify({ migration: counters, verification }, null, 2));
  if (
    verification.unlinkedSubscriptions ||
    verification.unlinkedInvoices ||
    verification.duplicateStripeIdentities ||
    verification.duplicateActiveEmails
  ) {
    process.exitCode = 1;
  }
} finally {
  await mongoose.connection.close();
}
