import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Plus, ReceiptText, RefreshCcw, WalletCards } from "lucide-react";
import {
  LoadingBlock,
  Notice,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import { api } from "../../lib/api";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
  humanize,
} from "../../lib/format";

const Amounts = ({ values = [] }) =>
  values.length ? (
    <span>
      {values
        .map((item) => formatMoney(item.amount, item.currency))
        .join(" · ")}
    </span>
  ) : (
    <span>—</span>
  );

export default function CustomerDetailPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api(`/customers/${id}`),
  });
  const activity = useQuery({
    queryKey: ["customer-activity", id],
    queryFn: () => api(`/customers/${id}/activity`),
  });
  const transactions = useQuery({
    queryKey: ["customer-transactions", id],
    queryFn: () => api(`/customers/${id}/transactions?limit=20`),
  });
  const subscriptions = useQuery({
    queryKey: ["customer-subscriptions", id],
    queryFn: () => api(`/customers/${id}/subscriptions?limit=20`),
  });
  const invoices = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: () => api(`/customers/${id}/invoices?limit=20`),
  });

  if (detail.isLoading) return <LoadingBlock rows={6} />;
  if (detail.error) return <Notice>{detail.error.message}</Notice>;
  const { customer, summary, identities } = detail.data;
  return (
    <>
      <PageHeader
        eyebrow="Customer record"
        title={customer.name || customer.email || "Customer"}
        description={customer.email || "No customer email was collected."}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={`/payment-links/new?customer=${customer._id}`} className="btn-primary">
              <Plus size={16} /> Request payment
            </Link>
            <Link to={`/subscription-plans?customer=${customer._id}`} className="btn-secondary">
              <RefreshCcw size={16} /> Offer subscription
            </Link>
            <Link to="/customers" className="btn-secondary">
              <ArrowLeft size={16} /> Back to customers
            </Link>
          </div>
        }
      />
      <div className="grid gap-5 md:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase text-muted">One-time received</p>
          <p className="mt-2 font-bold"><Amounts values={summary.oneTimeTotals} /></p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase text-muted">Recurring received</p>
          <p className="mt-2 font-bold"><Amounts values={summary.recurringTotals} /></p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase text-muted">Active subscriptions</p>
          <p className="mt-2 text-xl font-bold">{summary.activeSubscriptionCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase text-muted">Last activity</p>
          <p className="mt-2 font-bold">{formatDate(customer.lastSeenAt, true)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="font-bold">Overview</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-muted">Phone</dt><dd className="font-semibold">{customer.phone || "—"}</dd></div>
              <div><dt className="text-muted">First seen</dt><dd className="font-semibold">{formatDate(customer.firstSeenAt, true)}</dd></div>
              <div><dt className="text-muted">Sources</dt><dd className="font-semibold">{customer.sourceTypes?.join(", ") || "—"}</dd></div>
              <div><dt className="text-muted">Status</dt><dd className="mt-1"><StatusBadge status={customer.status} /></dd></div>
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="font-bold">Stripe identities</h2>
            <div className="mt-3 space-y-3">
              {identities.map((identity) => (
                <div key={identity._id} className="rounded-xl bg-slate-50 p-3 text-xs">
                  <p className="font-mono">{identity.stripeCustomerId}</p>
                  <p className="mt-1 text-muted">{identity.source} · {identity.stripeAccountId}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <section className="space-y-5">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><WalletCards size={18} /> One-time payments</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(transactions.data?.items || []).map((item) => (
                <Link key={item._id} to={`/transactions/${item._id}`} className="flex justify-between gap-4 py-3 hover:text-brand-700">
                  <span><strong>{item.paymentLink?.title || "Payment"}</strong><small className="block text-muted">{formatDate(item.paidAt || item.createdAt, true)}</small></span>
                  <span className="text-right"><strong>{formatMoney(Math.max(0, item.amount - (item.refundedAmount || 0)), item.currency)}</strong><small className="block"><StatusBadge status={item.status} /></small></span>
                </Link>
              ))}
              {!transactions.data?.items?.length ? <p className="py-5 text-sm text-muted">No one-time payments.</p> : null}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><RefreshCcw size={18} /> Subscriptions</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(subscriptions.data?.items || []).map((item) => (
                <Link key={item._id} to={`/subscriptions/${item._id}`} className="flex justify-between gap-4 py-3 hover:text-brand-700">
                  <span><strong>{item.plan?.name}</strong><small className="block text-muted">{formatBillingInterval(item.billingInterval)} · period ends {formatDate(item.currentPeriodEnd)}</small></span>
                  <span className="text-right"><strong>{formatMoney(item.amount, item.currency)}</strong><small className="block"><StatusBadge status={item.status} /></small></span>
                </Link>
              ))}
              {!subscriptions.data?.items?.length ? <p className="py-5 text-sm text-muted">No subscriptions.</p> : null}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><ReceiptText size={18} /> Recurring invoices</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(invoices.data?.items || []).map((item) => (
                <Link key={item._id} to={`/subscription-invoices/${item._id}`} className="flex justify-between gap-4 py-3 hover:text-brand-700">
                  <span><strong>{item.invoiceNumber || item.plan?.name || "Invoice"}</strong><small className="block text-muted">{formatDate(item.paidAt || item.createdAt, true)}</small></span>
                  <span className="text-right"><strong>{formatMoney(item.amountPaid || item.amountDue, item.currency)}</strong><small className="block"><StatusBadge status={item.paymentStatus} /></small></span>
                </Link>
              ))}
              {!invoices.data?.items?.length ? <p className="py-5 text-sm text-muted">No recurring invoices.</p> : null}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Mail size={18} /> Activity timeline</h2>
            {activity.error ? <div className="mt-3"><Notice>{activity.error.message}</Notice></div> : (
              <div className="mt-4 divide-y divide-slate-100">
                {(activity.data?.items || []).map((item, index) => (
                  <div key={`${item.type}-${item.resourceId}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div><p className="font-semibold">{item.title || humanize(item.type)}</p><p className="text-xs text-muted">{humanize(item.type)} · {formatDate(item.occurredAt, true)}</p></div>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
