import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { api } from "../../lib/api";
import { getSafeExternalUrl } from "../../lib/browser";
import { formatDate, formatMoney, humanize } from "../../lib/format";
import {
  LoadingBlock,
  Notice,
  PageHeader,
  StatusBadge,
} from "../../components/ui";

export default function SubscriptionInvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["subscription-invoice", id],
    queryFn: () => api(`/subscription-invoices/${id}`),
  });
  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.error) return <Notice>{query.error.message}</Notice>;
  const invoice = query.data.invoice;
  const hostedUrl = getSafeExternalUrl(invoice.hostedInvoiceUrl);
  const pdfUrl = getSafeExternalUrl(invoice.invoicePdfUrl);
  const rows = [
    ["Invoice", invoice.stripeInvoiceId],
    ["Subscription", invoice.stripeSubscriptionId],
    ["Customer", invoice.stripeCustomerId],
    ["Payment intent", invoice.stripePaymentIntentId],
    ["Charge", invoice.stripeChargeId],
    ["Connected account", invoice.stripeAccountId],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Recurring invoice"
        title={invoice.invoiceNumber || formatMoney(invoice.amountDue, invoice.currency)}
        description={`${invoice.plan?.name || "Subscription plan"} · ${formatDate(invoice.createdAt, true)}`}
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />
      {invoice.failureMessage ? (
        <div className="mb-5">
          <Notice>
            <strong>Payment attention:</strong> {invoice.failureMessage}
            {invoice.nextPaymentAttempt
              ? ` Stripe’s next attempt is ${formatDate(invoice.nextPaymentAttempt, true)}.`
              : ""}
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <ReceiptText size={24} />
              </div>
              <div>
                <p className="text-sm text-muted">Payment status</p>
                <p className="font-bold">
                  {humanize(invoice.paymentStatus)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={invoice.invoiceStatus} />
              <StatusBadge status={invoice.paymentStatus} />
            </div>
          </div>
          <div className="grid gap-5 py-7 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Amount due
              </p>
              <p className="mt-2 text-xl font-extrabold">
                {formatMoney(invoice.amountDue, invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Amount paid
              </p>
              <p className="mt-2 text-xl font-extrabold">
                {formatMoney(invoice.amountPaid, invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Remaining
              </p>
              <p className="mt-2 text-xl font-extrabold">
                {formatMoney(invoice.amountRemaining, invoice.currency)}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-5">
            <h2 className="font-bold">Invoice timeline</h2>
            <div className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
              <div>
                <p className="text-sm font-semibold">Invoice created</p>
                <p className="text-xs text-muted">
                  {formatDate(invoice.createdAt, true)}
                </p>
              </div>
              {invoice.paymentAttemptedAt ? (
                <div>
                  <p className="text-sm font-semibold">Payment attempted</p>
                  <p className="text-xs text-muted">
                    {formatDate(invoice.paymentAttemptedAt, true)}
                  </p>
                </div>
              ) : null}
              {invoice.paidAt ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    Payment succeeded
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(invoice.paidAt, true)}
                  </p>
                </div>
              ) : null}
              {invoice.failureMessage ? (
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
                    <TriangleAlert size={15} /> Payment failed
                  </p>
                  <p className="text-xs text-muted">{invoice.failureMessage}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        <aside className="space-y-5">
          <div className="card p-6">
            <h2 className="font-bold">Invoice documents</h2>
            <div className="mt-4 space-y-3">
              {hostedUrl ? (
                <a
                  href={hostedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full"
                >
                  <ExternalLink size={16} /> Open hosted invoice
                </a>
              ) : null}
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full"
                >
                  <Download size={16} /> Download invoice PDF
                </a>
              ) : null}
              {!hostedUrl && !pdfUrl ? (
                <p className="text-sm text-muted">
                  Stripe has not provided hosted invoice documents yet.
                </p>
              ) : null}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Related subscription</h2>
            <Link
              to={`/subscriptions/${invoice.subscription._id}`}
              className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-700"
            >
              {invoice.subscription.customerName ||
                invoice.subscription.customerEmail ||
                "View subscription"}
              <ExternalLink size={16} />
            </Link>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Billing details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Billing reason</dt>
                <dd className="text-right font-semibold">
                  {humanize(invoice.billingReason || "Unknown")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Period</dt>
                <dd className="text-right font-semibold">
                  {formatDate(invoice.periodStart)} –{" "}
                  {formatDate(invoice.periodEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Next retry</dt>
                <dd className="text-right font-semibold">
                  {formatDate(invoice.nextPaymentAttempt, true)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Stripe identifiers</h2>
            <dl className="mt-4 space-y-4 text-xs">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 break-all font-mono">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
