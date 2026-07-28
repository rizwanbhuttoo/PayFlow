import { z } from "zod";
import {
  PAYMENT_LINK_STATUSES,
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_INVOICE_STATUSES,
  SUBSCRIPTION_PAYMENT_STATUSES,
  SUBSCRIPTION_PLAN_STATUSES,
  SUBSCRIPTION_STATUSES,
  SUPPORTED_CURRENCIES,
  TRANSACTION_STATUSES,
  CUSTOMER_SOURCE_TYPES,
} from "../../../shared/domain.js";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier");
const optionalQuery = (schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
const password = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(72)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  password,
});

export const loginSchema = z.strictObject({ email, password: z.string().min(1).max(72) });
export const forgotPasswordSchema = z.strictObject({ email });
export const tokenSchema = z.strictObject({ token: z.string().length(64) });
export const resetPasswordSchema = tokenSchema.extend({ password });

export const profileSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});

export const paymentLinkSchema = z.strictObject({
  customer: objectId,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  amount: z.coerce.number().int().positive().max(99999999999),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(SUPPORTED_CURRENCIES)),
  internalReference: z.string().trim().max(100).optional().default(""),
  expiresAt: z
    .union([
      z.coerce
        .date()
        .refine(
          (date) => date >= new Date(Date.now() + 30 * 60 * 1000),
          "Checkout expiry must be at least 30 minutes from now"
        )
        .refine(
          (date) => date <= new Date(Date.now() + 24 * 60 * 60 * 1000),
          "Checkout expiry must be within 24 hours"
        ),
      z.literal(""),
    ])
    .optional()
    .transform((value) => value || undefined),
  redirectUrl: z
    .union([z.string().url().refine((url) => url.startsWith("https://"), "Redirect URL must use HTTPS"), z.literal("")])
    .optional()
    .default(""),
});

export const paymentEmailSchema = z.strictObject({
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().max(2000).optional().default(""),
});

export const customerCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  email,
  phone: z.string().trim().max(50).optional().default(""),
});

export const idParamsSchema = z.strictObject({ id: objectId });

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

export const paymentLinkQuerySchema = z.strictObject({
  ...paginationFields,
  search: z.string().trim().max(100).optional().default(""),
  status: optionalQuery(z.enum(PAYMENT_LINK_STATUSES)),
});

export const linkTransactionsQuerySchema = z.strictObject(paginationFields);

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date");

const optionalBooleanQuery = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value === "true"),
  z.boolean().optional()
);

export const customerQuerySchema = z
  .strictObject({
    ...paginationFields,
    search: z.string().trim().max(120).optional().default(""),
    source: optionalQuery(z.enum(CUSTOMER_SOURCE_TYPES)),
    hasActiveSubscription: optionalBooleanQuery,
    hasFailedPayment: optionalBooleanQuery,
    createdFrom: optionalQuery(dateField),
    createdTo: optionalQuery(dateField),
    activityFrom: optionalQuery(dateField),
    activityTo: optionalQuery(dateField),
  })
  .refine(
    ({ createdFrom, createdTo }) =>
      !createdFrom || !createdTo || createdFrom <= createdTo,
    { message: "Invalid created date range", path: ["createdTo"] }
  )
  .refine(
    ({ activityFrom, activityTo }) =>
      !activityFrom || !activityTo || activityFrom <= activityTo,
    { message: "Invalid activity date range", path: ["activityTo"] }
  );

export const transactionQuerySchema = z
  .strictObject({
    ...paginationFields,
    search: z.string().trim().max(120).optional().default(""),
    status: optionalQuery(z.enum(TRANSACTION_STATUSES)),
    paymentLink: optionalQuery(objectId),
    from: optionalQuery(dateField),
    to: optionalQuery(dateField),
  })
  .refine(
    ({ from, to }) => !from || !to || from <= to,
    { message: "The end date must not be earlier than the start date", path: ["to"] }
  );

export const subscriptionPlanSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  amount: z.coerce.number().int().positive().max(99999999999),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(SUPPORTED_CURRENCIES)),
  billingInterval: z.enum(SUBSCRIPTION_BILLING_INTERVALS),
  internalReference: z.string().trim().max(100).optional().default(""),
  successMessage: z.string().trim().max(500).optional().default(""),
  redirectUrl: z
    .union([
      z
        .string()
        .url()
        .refine((url) => url.startsWith("https://"), "Redirect URL must use HTTPS"),
      z.literal(""),
    ])
    .optional()
    .default(""),
});

export const subscriptionPlanCheckoutSchema = z.strictObject({
  customer: objectId,
});

export const subscriptionPlanEmailSchema = z.strictObject({
  customer: objectId,
  checkoutSessionId: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .regex(/^cs_[A-Za-z0-9_]+$/, "Invalid Checkout Session identifier"),
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().max(2000).optional().default(""),
});

export const subscriptionPlanQuerySchema = z.strictObject({
  ...paginationFields,
  search: z.string().trim().max(100).optional().default(""),
  status: optionalQuery(z.enum(SUBSCRIPTION_PLAN_STATUSES)),
  billingInterval: optionalQuery(z.enum(SUBSCRIPTION_BILLING_INTERVALS)),
});

export const subscriptionQuerySchema = z
  .strictObject({
    ...paginationFields,
    search: z.string().trim().max(120).optional().default(""),
    status: optionalQuery(z.enum(SUBSCRIPTION_STATUSES)),
    plan: optionalQuery(objectId),
    billingInterval: optionalQuery(z.enum(SUBSCRIPTION_BILLING_INTERVALS)),
    from: optionalQuery(dateField),
    to: optionalQuery(dateField),
  })
  .refine(
    ({ from, to }) => !from || !to || from <= to,
    {
      message: "The end date must not be earlier than the start date",
      path: ["to"],
    }
  );

export const subscriptionInvoiceQuerySchema = z
  .strictObject({
    ...paginationFields,
    search: z.string().trim().max(120).optional().default(""),
    subscription: optionalQuery(objectId),
    plan: optionalQuery(objectId),
    invoiceStatus: optionalQuery(z.enum(SUBSCRIPTION_INVOICE_STATUSES)),
    paymentStatus: optionalQuery(z.enum(SUBSCRIPTION_PAYMENT_STATUSES)),
    from: optionalQuery(dateField),
    to: optionalQuery(dateField),
  })
  .refine(
    ({ from, to }) => !from || !to || from <= to,
    {
      message: "The end date must not be earlier than the start date",
      path: ["to"],
    }
  );

export const cancellationSchema = z.strictObject({
  type: z.enum(["period_end", "immediate"]),
  reason: z.string().trim().max(500).optional().default(""),
  confirmed: z.literal(true, {
    error: "Cancellation confirmation is required",
  }),
});

export const publicCheckoutParamsSchema = z.strictObject({
  planId: objectId,
  sessionId: z.string().trim().regex(/^cs_(?:test_|live_)?[A-Za-z0-9]+$/, "Invalid checkout session"),
});

export const customerManagementTokenSchema = z.strictObject({
  token: z.string().trim().min(32).max(256),
});
