# PayFlow

PayFlow is a production-structured MERN MVP for customer-first one-time payments
and fixed monthly or yearly subscriptions through Stripe Connect. A user
verifies their email, connects a Stripe Express account, creates a customer, and
then sends that known customer a dedicated hosted checkout.

Cloudinary stores and transforms profile images. Resend delivers verification,
password-reset, and payment-request emails. Stripe hosts onboarding and checkout,
so PayFlow never stores bank, identity-document, or card data.

This README is the single source of truth for project scope, setup, verification,
and deployment.

## What is included

- JWT registration, verified-email login, password recovery, profile updates, and
  password changes
- Stripe Connect Express onboarding, live capability refresh, and Express
  Dashboard login
- Customer-bound one-time Stripe Checkout Sessions created directly on each
  connected account
- Fixed monthly or yearly Stripe products and recurring prices, with a fresh
  customer-bound Checkout Session for every subscription invitation
- Manually creatable unified customers spanning one-time payments,
  subscriptions, invoices, and emails
- Recurring payment success, failure, authentication, retry-date, and revenue
  tracking through Stripe Billing webhooks
- Period-end cancellation, immediate cancellation without automatic refunds,
  cancellation reversal, and one-time emailed authorization for Customer Portal sessions
- Searchable/filterable payment requests and transaction history with ownership checks
- Searchable/filterable subscription plans, subscribers, and recurring invoices
- Resend payment-request email and customer-bound checkout URL controls
- Optional branded subscription emails decoupled from Checkout creation, with
  Copy, Open, and browser Share alternatives
- Subscription started and cancellation notices; Stripe owns invoice receipts
  and payment-recovery emails
- Signed Stripe Connect webhooks persisted before acknowledgement, with durable
  retries, stale-lock recovery, and dead-letter state
- Idempotent Stripe customer, product, price, Checkout Session, and cancellation operations
- Stripe-synchronized Checkout Session expiration, periodic reconciliation, and
  a Stripe-verified subscription callback repair when webhook delivery is delayed
- Currency-separated dashboard totals, customer health metrics, and short caching
- Cloudinary image validation, resizing, optimization, and secure URL storage
- Zod request validation, bcrypt hashing, Helmet, CORS, rate limiting, pagination,
  and centralized errors
- Responsive React UI with loading, empty, error, success, and confirmation states

## Architecture and operational controls

- `Customer` is the shared identity for one-time transactions, subscriptions,
  recurring invoices, and billing emails.
- Active normalized customer emails are unique within a platform user and
  connected Stripe account. Stripe customer identities are also scoped to the
  connected account.
- A one-time request creates a customer-bound Checkout Session. A subscription
  plan is a reusable price template, while each invitation creates a fresh
  customer-bound Checkout Session.
- Checkout creation never depends on email delivery. Email is an optional action
  after the URL exists, so a provider failure does not block Copy, Open, Share,
  or customer checkout.
- Stripe operations use durable idempotency records and provider idempotency keys.
- Stripe webhooks are signature-verified, stored before acknowledgement, claimed
  atomically, retried with bounded backoff, and dead-lettered after exhaustion.
  The subscription success callback independently retrieves the completed Session
  from the connected Stripe account and repairs a missing initial portal record;
  webhooks remain required for renewals, failures, refunds, and cancellations.
- Customer Portal access uses hashed, expiring, one-time tokens delivered to the
  verified customer email.
- Checkout expiration is synchronized with Stripe before the local request is
  marked expired. Legacy Stripe Payment Links remain supported for historical
  records.
- Financial totals are derived from verified Stripe events and reconciled without
  combining different currencies.

## Project structure

```text
.
├── client/                    React + Vite application
│   └── src/
│       ├── components/        Layout, route guards, reusable UI
│       ├── context/           Authentication state
│       ├── features/          Auth, dashboard, Stripe, payments, subscriptions
│       └── lib/               API client and format helpers
├── server/                    Express API
│   ├── src/
│   │   ├── config/            Environment, MongoDB, provider clients
│   │   ├── controllers/       HTTP request handlers
│   │   ├── middleware/        Auth, upload, validation, errors
│   │   ├── models/            Mongoose records and indexes
│   │   ├── routes/            REST and raw-body webhook routes
│   │   ├── services/          Stripe, webhook, Resend, Cloudinary logic
│   │   └── validation/        Zod schemas
│   └── test/                  Node unit tests
├── .env.example
└── package.json               npm workspaces and combined scripts
```

## Local setup, step by step

Requirements: Node.js 20+, npm 10+, MongoDB 7+ (local or Atlas), a Stripe account
with Connect enabled, a Resend account, and a Cloudinary account.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create the server environment file.

   ```bash
   cp .env.example .env
   ```

3. Create the optional frontend environment file. The built-in API default is
   already `http://localhost:5000/api`, but an explicit file is clearer.

   ```bash
   cp client/.env.example client/.env
   ```

4. Set `MONGODB_URI` and generate a strong JWT key.

   ```bash
   openssl rand -hex 32
   ```

   Put the output in `JWT_SECRET`.

5. Configure Stripe in test mode:

   - In Stripe, enable Connect and complete the platform profile.
   - Copy the test secret and publishable keys into `.env`.
   - Keep both onboarding URLs set to the Vite URLs shown in `.env.example`.
   - Install and authenticate the Stripe CLI, then forward platform and connected
     account events:

     ```bash
     stripe listen \
       --events checkout.session.completed,payment_intent.succeeded,payment_intent.payment_failed,charge.succeeded,charge.refunded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.created,invoice.finalized,invoice.paid,invoice.payment_failed,invoice.payment_action_required,invoice.voided,invoice.marked_uncollectible,account.updated \
       --forward-to localhost:5000/api/webhooks/stripe \
       --forward-connect-to localhost:5000/api/webhooks/stripe
     ```

   - Copy the printed `whsec_...` value to `STRIPE_WEBHOOK_SECRET`.
   - For a deployed app, create a Connect webhook endpoint pointing to
     `https://YOUR_API/api/webhooks/stripe` and select events on connected accounts.
   - In **Billing → Customer portal**, activate a portal configuration that lets
     customers update payment methods, view/download invoices, and cancel
     subscriptions according to the desired immediate or period-end policy.
   - In **Billing → Subscriptions and emails**, enable Stripe invoice receipts,
     failed-payment notifications, and payment-recovery emails. PayFlow deliberately
     does not duplicate these provider-owned payment messages.

6. Configure Resend:

   - Create an API key and set `RESEND_API_KEY`.
   - Verify a sending domain in Resend.
   - Set `EMAIL_FROM_ADDRESS` to an address on that domain.
   - Resend's onboarding sender is useful for initial development but may restrict
     recipients. A verified domain is required for real customer delivery.

   If `RESEND_API_KEY` is omitted in development, the email worker records a
   development delivery and returns verification/reset tokens to the local UI.
   Production fails closed when Resend is not configured.

7. Configure Cloudinary:

   - Copy the cloud name, API key, and API secret from the Cloudinary dashboard.
   - Set `CLOUDINARY_FOLDER` if profile images should use another folder.
   - Keep the API secret only in the server `.env`; never add it to `client/.env`.

   Images are restricted to JPEG, PNG, or WebP and 5 MB, cropped to a face-aware
   512×512 asset, and delivered through a Cloudinary secure URL.

8. Start both applications.

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173`. The API health endpoint is
   `http://localhost:5000/api/health`.

## Verification flow

Use this order for a complete Stripe test:

1. Register and open the verification email.
2. Sign in and open **Stripe account**.
3. Select **Connect Stripe** and complete Stripe's test onboarding.
4. Return to PayFlow and confirm that details, charges, and payouts show their live
   Stripe values.
5. Open **Customers** and add a known client. Re-enter the same email with
   different capitalization and confirm PayFlow reuses/rejects the duplicate.
6. From the customer record, create a payment request. The amount entered in the
   UI is converted to the currency's minor unit before storage and Stripe
   creation.
7. Copy, open, share, or optionally email the customer-bound checkout. In a
   private window, use a Stripe test card such as
   `4242 4242 4242 4242`, any future expiry, and any CVC.
8. Confirm that Stripe Checkout shows the selected customer's email and that the
   webhook CLI reports delivery and the transaction appears
   in PayFlow.
9. Re-send the same event from Stripe. The unique event record and atomic processing
   claim prevent duplicate transaction totals.
10. Use a Stripe test method that fails, then confirm the failed status appears in
    transaction filters.

### Subscription verification

1. Create one monthly plan and one yearly plan under a charge-enabled connected
   account. Confirm the Stripe Express account owns each product and recurring
   price. Plans are templates and do not expose a generic public link.
2. Select **Create customer checkout** and choose an existing customer. Confirm
   the URL appears before any email is requested. Test Copy, Open, and Share,
   then optionally queue an email. Complete checkout with
   `4242 4242 4242 4242`.
3. Confirm the success page shows the plan, verified status, masked customer email,
   next billing date, and **Subscription saved to the PayFlow portal**. The callback
   verifies the Session directly with Stripe and repairs a delayed initial webhook;
   webhooks remain the source of ongoing billing changes.
4. Confirm one unified customer, subscription, and first invoice appear.
   Re-send the Checkout, subscription, and invoice events and verify no duplicates
   or revenue inflation are created.
5. Use a test clock or Stripe CLI test event to advance a billing period. Confirm a
   paid recurring invoice increases collected revenue exactly once.
6. Exercise a failed recurring payment and an authentication-required payment.
   Confirm the invoice status, failure message, and Stripe-controlled next retry
   date are displayed without increasing revenue.
7. Schedule period-end cancellation and verify the subscription remains active with
   a **Cancels on** date. Remove the schedule and confirm it renews again.
8. Schedule period-end cancellation once more and let the test clock reach the end;
   confirm the final `customer.subscription.deleted` event marks it canceled.
9. Create another subscription and cancel it immediately. Confirm Stripe creates no
   automatic refund or prorated credit.
10. Open the one-time management link delivered to the verified email. Use it to
    open the Customer Portal; confirm the Checkout Session URL alone cannot do so.
    Update the payment method, view/download an invoice, and cancel; confirm all
    changes return through webhooks.

Run automated checks before and after manual provider testing:

```bash
npm test
npm run check
npm audit --audit-level=high
```

PayFlow never fakes a successful Stripe payment. Successful records originate only
from signature-verified Stripe events or a server-side retrieval of the exact
Checkout Session from its connected Stripe account.

Expected automated result for the current source:

- 21 server tests pass.
- 6 client tests pass.
- Server syntax checks, client lint, and the production build pass.
- `npm audit --audit-level=high` reports no known vulnerabilities at the time of
  the last project verification.

## Financial metric definitions

- **Gross collected** is the amount confirmed by Stripe before refunds and fees.
- **Refunded** is the amount Stripe reports returned to the payer.
- **Total received** is gross collected minus reported refunds, never below zero.
- **Platform fee** is the application fee configured by this platform.
- **Stripe processing fee** comes from the connected charge's balance transaction.
- **Net** is Stripe's balance-transaction net amount. When balance data is not
  available, PayFlow shows fee and net values as unavailable instead of zero.
- Payment-link performance separates retained, fully refunded, and partially
  refunded payment attempts.

## API overview

All application endpoints are under `/api`. Protected endpoints use
`Authorization: Bearer <JWT>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/logout`; `GET /auth/me` |
| User | `PATCH /users/profile`, `/users/password`; `POST /users/profile-image` |
| Stripe | `GET /stripe/status`; `POST /stripe/onboarding`, `/stripe/refresh`, `/stripe/dashboard` |
| Payment requests | `GET/POST /payment-links`; `GET /payment-links/:id`; `PATCH /:id/deactivate`; `POST /:id/email`; `GET /:id/transactions` |
| Transactions | `GET /transactions`, `GET /transactions/:id` |
| Customers | `GET/POST /customers`, `GET /customers/:id`, `GET /:id/activity`, `/transactions`, `/subscriptions`, `/invoices` |
| Subscription plans | `GET/POST /subscription-plans`; `GET /subscription-plans/:id`; `PATCH /:id/deactivate`; `POST /:id/checkout`, `/:id/email` |
| Subscriptions | `GET /subscriptions`, `GET /subscriptions/:id`, `GET /:id/invoices`; `POST /:id/cancel`, `/resume`, `/portal` |
| Recurring invoices | `GET /subscription-invoices`, `GET /subscription-invoices/:id` |
| Public checkout | `GET /subscription-checkout/:planId/sessions/:sessionId`; `POST /subscription-checkout/manage/summary`, `/manage/portal` |
| Dashboard | `GET /dashboard/summary`, `/dashboard/recent`, `/dashboard/alerts` |
| Webhook | `POST /webhooks/stripe` (raw body, Stripe signature required) |

List endpoints accept `page` and `limit`. Subscription plans support `search`,
`status`, and `billingInterval`; subscriptions support plan, interval, status, and
date filters; recurring invoices support invoice/payment status, plan,
subscription, and date filters.


## Deployment notes

- Run the API on a Node host that supports long-running Express processes. Set
  `NODE_ENV=production` and every required secret in the host's secret manager.
- Build the frontend with `npm run build` and deploy `client/dist` to a static host.
  Configure SPA fallback to `index.html`.
- Set `CLIENT_URL`, `SERVER_URL`, `VITE_API_URL`, Stripe return/refresh URLs, CORS,
  and the production Connect webhook to their public HTTPS origins.
- Use MongoDB Atlas or a secured replica set, provider secret rotation, TLS, and
  platform logs that redact authorization headers and webhook bodies.
- Run `npm run migrate:customers -w server` before deploying the customer-first
  release. It merges duplicate active normalized emails within the same owner
  and connected account, reassigns their history, marks legacy generic links,
  and synchronizes the affected indexes. Inspect its report and keep a database
  backup until verification is complete. It does not drop the legacy collection.
- Stripe event and email work is claimed atomically from MongoDB. A separate
  webhook process can be run with `npm run worker:webhooks -w server`.
- Run `npm run reconcile -w server` on demand; the API also schedules periodic
  reconciliation while running.
- Rotate any Stripe, webhook, Resend, or Cloudinary credentials that were ever
  included in a shared `.env` before production deployment.
- Run `npm run release:archive` to generate a ZIP from tracked source. The release
  script rejects tracked environment files and excludes Git metadata,
  dependencies, logs, and build output.
