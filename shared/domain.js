export const SUPPORTED_CURRENCIES = ["usd", "eur", "gbp", "cad", "aud"];

export const PAYMENT_LINK_STATUSES = ["active", "completed", "inactive", "expired"];

export const TRANSACTION_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
];

export const ONBOARDING_STATUSES = [
  "not_started",
  "pending",
  "completed",
  "restricted",
];

export const WEBHOOK_EVENT_STATUSES = [
  "received",
  "processing",
  "deferred",
  "processed",
  "failed",
  "dead_letter",
  "ignored",
];

export const WEBHOOK_MAX_ATTEMPTS = 5;

export const CUSTOMER_STATUSES = ["active", "archived", "merged"];
export const CUSTOMER_SOURCE_TYPES = ["one_time", "subscription", "email", "import", "manual"];
export const CUSTOMER_STRIPE_IDENTITY_SOURCES = ["one_time", "subscription", "import", "manual"];

export const IDEMPOTENCY_OPERATION_TYPES = [
  "payment_link_create",
  "subscription_plan_create",
  "subscription_invitation",
  "subscription_cancel",
];
export const IDEMPOTENCY_OPERATION_STATUSES = ["started", "completed", "failed"];

export const EMAIL_DELIVERY_STATUSES = ["queued", "processing", "sent", "failed", "dead_letter"];
export const EMAIL_MAX_ATTEMPTS = 5;

export const SUBSCRIPTION_BILLING_INTERVALS = ["monthly", "yearly"];

export const SUBSCRIPTION_PLAN_STATUSES = ["active", "inactive"];

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
];

export const SUBSCRIPTION_INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
];

export const SUBSCRIPTION_PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "action_required",
];

export const SUBSCRIPTION_EMAIL_TYPES = [
  "subscription_invitation",
  "subscription_started",
  "payment_succeeded",
  "payment_failed",
  "payment_action_required",
  "cancellation_scheduled",
  "subscription_canceled",
  "customer_management",
];
