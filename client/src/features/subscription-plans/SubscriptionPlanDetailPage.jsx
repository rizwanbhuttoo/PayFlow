import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useNavigate, useSearchParams } from "../../lib/router";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Share2,
  Unlink,
} from "lucide-react";
import {
  api,
  idempotentJsonOptions,
  jsonOptions,
  newIdempotencyKey,
} from "../../lib/api";
import {
  copyText,
  getSafeExternalUrl,
  shareContent,
} from "../../lib/browser";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from "../../lib/format";
import {
  ButtonLoader,
  Field,
  LoadingBlock,
  Modal,
  Notice,
  PageHeader,
  SelectField,
  StatusBadge,
  TextareaField,
} from "../../components/ui";

const emailSchema = z.object({
  customer: z.string().regex(/^[a-f\d]{24}$/i, "Select a customer"),
  subject: z.string().trim().min(1, "Subject is required").max(160),
  message: z.string().max(2000).optional(),
});

function SubscriptionCheckoutModal({ plan, initialCustomer, onClose }) {
  const [checkout, setCheckout] = useState(null);
  const [checkoutCustomer, setCheckoutCustomer] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [apiError, setApiError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [operationKey] = useState(newIdempotencyKey);
  const customers = useQuery({
    queryKey: ["customers", "subscription-invitation-picker"],
    queryFn: () => api("/customers?limit=50"),
  });
  const selectedCustomer = useQuery({
    queryKey: ["customer", initialCustomer],
    queryFn: () => api(`/customers/${initialCustomer}`),
    enabled: /^[a-f\d]{24}$/i.test(initialCustomer || ""),
  });
  const customerOptions = [...(customers.data?.items || [])];
  if (
    selectedCustomer.data?.customer &&
    !customerOptions.some(
      (customer) => customer._id === selectedCustomer.data.customer._id
    )
  ) {
    customerOptions.unshift(selectedCustomer.data.customer);
  }
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      customer: initialCustomer || "",
      subject: `Subscription invitation: ${plan.name}`,
      message: "",
    },
  });

  const createCheckout = async (values) => {
    setApiError("");
    setActionNotice("");
    try {
      const result = await api(
        `/subscription-plans/${plan._id}/checkout`,
        idempotentJsonOptions(
          "POST",
          { customer: values.customer },
          operationKey
        )
      );
      setCheckout(result.checkout);
      setCheckoutCustomer(result.customer);
    } catch (error) {
      setApiError(error.message);
    }
  };

  const sendEmail = async (values) => {
    setApiError("");
    try {
      await api(
        `/subscription-plans/${plan._id}/email`,
        jsonOptions("POST", {
          customer: values.customer,
          checkoutSessionId: checkout.id,
          subject: values.subject,
          message: values.message,
        })
      );
      setEmailSent(true);
      setActionNotice("Email queued. The checkout remains available below.");
    } catch (error) {
      setApiError(
        `${error.message}. The checkout is still ready to copy, open, or share.`
      );
    }
  };

  const copyCheckout = async () => {
    const didCopy = await copyText(checkout.url);
    setCopied(didCopy);
    setActionNotice(
      didCopy
        ? "Subscription checkout copied."
        : "Clipboard access is unavailable. Select the URL and copy it manually."
    );
  };

  const shareCheckout = async () => {
    const result = await shareContent({
      title: plan.name,
      text: `${plan.name} — ${formatMoney(plan.amount, plan.currency)} ${
        plan.billingInterval === "yearly" ? "per year" : "per month"
      }`,
      url: checkout.url,
    });
    if (result === "unsupported") {
      await copyCheckout();
    } else if (result === "shared") {
      setActionNotice("Subscription checkout shared.");
    } else if (result === "failed") {
      setActionNotice("Sharing failed. Copy the checkout URL instead.");
    }
  };

  const safeCheckoutUrl = checkout
    ? getSafeExternalUrl(checkout.url)
    : null;

  return (
    <Modal title="Create customer checkout" onClose={onClose}>
      <form
        onSubmit={handleSubmit(checkout ? sendEmail : createCheckout)}
        className="space-y-4"
      >
        {apiError ? <Notice>{apiError}</Notice> : null}
        {actionNotice ? (
          <Notice type={copied || emailSent ? "success" : "info"}>
            {actionNotice}
          </Notice>
        ) : null}
        {!checkout ? (
          <>
            <p className="text-sm leading-6 text-muted">
              Create the Stripe Checkout first. Email is optional and will not
              affect Checkout creation.
            </p>
            {customers.error ? <Notice>{customers.error.message}</Notice> : null}
            <SelectField label="Customer" error={errors.customer} {...register("customer")}>
              <option value="">Select a saved customer</option>
              {customerOptions.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name || "Customer"} — {customer.email}
                </option>
              ))}
            </SelectField>
            {!customers.isLoading && !customerOptions.length ? (
              <Notice>
                Add a customer before creating a checkout.{" "}
                <Link to={`/customers/new?returnTo=/subscription-plans/${plan._id}`} className="font-bold underline">Add customer</Link>
              </Notice>
            ) : null}
            <button
              className="btn-primary w-full"
              disabled={isSubmitting || !customerOptions.length}
            >
              {isSubmitting ? (
                <ButtonLoader label="Creating checkout…" />
              ) : (
                <>
                  <Link2 size={16} /> Create checkout
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-900">Checkout ready</p>
              <p className="mt-1 text-sm text-emerald-800">
                {checkoutCustomer?.name || "Customer"} · {checkoutCustomer?.email}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                A subscription is created only after the customer completes Stripe Checkout.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-muted">
                Customer-bound Checkout URL
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={checkout.url}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
                <button type="button" onClick={copyCheckout} className="btn-secondary !py-2">
                  <Copy size={15} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {checkout.expiresAt ? (
                <p className="mt-2 text-xs text-muted">
                  Expires {formatDate(new Date(checkout.expiresAt * 1000), true)}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button type="button" onClick={copyCheckout} className="btn-secondary">
                <Copy size={16} /> Copy
              </button>
              {safeCheckoutUrl ? (
                <a href={safeCheckoutUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  <ExternalLink size={16} /> Open
                </a>
              ) : (
                <button type="button" disabled className="btn-secondary">
                  <ExternalLink size={16} /> Open
                </button>
              )}
              <button type="button" onClick={shareCheckout} className="btn-secondary">
                <Share2 size={16} /> Share
              </button>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-bold">Optional email</p>
              <div className="space-y-4">
                <Field
                  label="Subject"
                  error={errors.subject}
                  {...register("subject")}
                />
                <TextareaField
                  label="Personal message"
                  placeholder="Here is the subscription option we discussed…"
                  error={errors.message}
                  {...register("message")}
                />
              </div>
            </div>
            <button
              className="btn-primary w-full"
              disabled={isSubmitting || emailSent}
            >
              {isSubmitting ? (
                <ButtonLoader label="Sending…" />
              ) : emailSent ? (
                <>
                  <Mail size={16} /> Email queued
                </>
              ) : (
                <>
                  <Mail size={16} /> Email customer
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary w-full">
              Done
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}

export default function SubscriptionPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showCheckout, setShowCheckout] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const query = useQuery({
    queryKey: ["subscription-plan", id],
    queryFn: () => api(`/subscription-plans/${id}`),
  });
  const subscriptions = useQuery({
    queryKey: ["subscriptions", "plan", id],
    queryFn: () => api(`/subscriptions?plan=${id}&limit=5`),
  });
  const invoices = useQuery({
    queryKey: ["subscription-invoices", "plan", id],
    queryFn: () => api(`/subscription-invoices?plan=${id}&limit=5`),
  });
  const deactivate = useMutation({
    mutationFn: () =>
      api(
        `/subscription-plans/${id}/deactivate`,
        jsonOptions("PATCH")
      ),
    onSuccess: async () => {
      setConfirmDeactivate(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["subscription-plan", id],
        }),
        queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.error) return <Notice>{query.error.message}</Notice>;
  const plan = query.data.plan;

  return (
    <>
      <PageHeader
        eyebrow="Subscription plan"
        title={plan.name}
        description={
          plan.internalReference || `Created ${formatDate(plan.createdAt)}`
        }
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />
      {deactivate.error ? (
        <div className="mb-5">
          <Notice>{deactivate.error.message}</Notice>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Recurring price
                </p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">
                  {formatMoney(plan.amount, plan.currency)}
                  <span className="ml-2 text-base font-semibold text-muted">
                    / {plan.billingInterval === "yearly" ? "year" : "month"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={plan.status} />
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                  {formatBillingInterval(plan.billingInterval)}
                </span>
              </div>
            </div>
            {plan.description ? (
              <p className="mt-6 border-t border-slate-100 pt-6 text-sm leading-6 text-muted">
                {plan.description}
              </p>
            ) : null}
            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="font-bold text-brand-800">Customer-first invitations</p>
              <p className="mt-1 text-sm leading-6 text-brand-700">
                This plan is a reusable price template. Each invitation creates a new Stripe Checkout Session tied to the selected saved customer.
              </p>
            </div>
            <div className="mt-5">
              <button
                disabled={plan.status !== "active"}
                onClick={() => setShowCheckout(true)}
                className="btn-primary"
              >
                <Link2 size={16} /> Create customer checkout
              </button>
            </div>
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold">Subscribers</h2>
                <p className="text-xs text-muted">
                  {plan.activeSubscriberCount} currently active
                </p>
              </div>
              <Link
                to={`/subscriptions?plan=${plan._id}`}
                className="text-xs font-bold text-brand-600"
              >
                View all
              </Link>
            </div>
            {subscriptions.isLoading ? (
              <div className="p-5">
                <LoadingBlock rows={2} />
              </div>
            ) : subscriptions.error ? (
              <div className="p-5">
                <Notice>{subscriptions.error.message}</Notice>
              </div>
            ) : subscriptions.data.items.length ? (
              <div className="divide-y divide-slate-100">
                {subscriptions.data.items.map((item) => (
                  <Link
                    to={`/subscriptions/${item._id}`}
                    key={item._id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.customerName ||
                          item.customerEmail ||
                          "Stripe customer"}
                      </p>
                      <p className="text-xs text-muted">
                        Renews {formatDate(item.currentPeriodEnd)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                    <ArrowUpRight size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted">
                No customers have subscribed yet.
              </p>
            )}
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold">Recurring payments</h2>
                <p className="text-xs text-muted">Latest Stripe invoices</p>
              </div>
              <Link
                to={`/subscription-invoices?plan=${plan._id}`}
                className="text-xs font-bold text-brand-600"
              >
                View all
              </Link>
            </div>
            {invoices.data?.items.length ? (
              <div className="divide-y divide-slate-100">
                {invoices.data.items.map((invoice) => (
                  <Link
                    to={`/subscription-invoices/${invoice._id}`}
                    key={invoice._id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {invoice.subscription?.customerEmail ||
                          invoice.invoiceNumber ||
                          "Stripe invoice"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(invoice.createdAt, true)}
                      </p>
                    </div>
                    <p className="text-sm font-bold">
                      {formatMoney(invoice.amountPaid, invoice.currency)}
                    </p>
                    <StatusBadge status={invoice.paymentStatus} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted">
                No recurring invoice events yet.
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <div className="card p-6">
            <h2 className="font-bold">Plan performance</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Total subscribers</dt>
                <dd className="font-bold">{plan.totalSubscribers}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Active subscribers</dt>
                <dd className="font-bold">{plan.activeSubscriberCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Revenue collected</dt>
                <dd className="font-bold">
                  {formatMoney(
                    plan.totalRecurringRevenue,
                    plan.currency
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Stripe identifiers</h2>
            <dl className="mt-4 space-y-3 text-xs">
              {plan.stripePaymentLinkId ? (
                <div>
                  <dt className="text-muted">Legacy payment link</dt>
                  <dd className="mt-1 break-all font-mono">
                    {plan.stripePaymentLinkId}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Product</dt>
                <dd className="mt-1 break-all font-mono">
                  {plan.stripeProductId}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Recurring price</dt>
                <dd className="mt-1 break-all font-mono">
                  {plan.stripePriceId}
                </dd>
              </div>
            </dl>
          </div>
          {plan.status === "active" ? (
            <button
              onClick={() => setConfirmDeactivate(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              <Unlink size={16} /> Deactivate plan
            </button>
          ) : null}
        </aside>
      </div>
      {showCheckout ? (
        <SubscriptionCheckoutModal
          plan={plan}
          initialCustomer={searchParams.get("customer")}
          onClose={() => setShowCheckout(false)}
        />
      ) : null}
      {confirmDeactivate ? (
        <Modal
          title="Deactivate subscription plan?"
          onClose={() => setConfirmDeactivate(false)}
        >
          <p className="text-sm leading-6 text-muted">
            New subscriptions will stop. Existing subscribers, billing
            schedules, invoices, and payment history will remain unchanged.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="btn-secondary"
              onClick={() => setConfirmDeactivate(false)}
            >
              Keep active
            </button>
            <button
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
            >
              {deactivate.isPending ? "Deactivating…" : "Deactivate plan"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
