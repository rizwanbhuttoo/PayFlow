import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CircleDollarSign, Clock3, ExternalLink, UserRound } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney, humanize } from "../../lib/format";
import { LoadingBlock, Notice, PageHeader, StatusBadge } from "../../components/ui";

export default function TransactionDetailPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["transaction", id], queryFn: () => api(`/transactions/${id}`) });
  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.error) return <Notice>{query.error.message}</Notice>;
  const item = query.data.transaction;
  const rows = [
    ["Checkout session", item.stripeCheckoutSessionId],
    ["Payment intent", item.stripePaymentIntentId],
    ["Charge", item.stripeChargeId],
    ["Connected account", item.stripeAccountId],
  ];
  return (
    <>
      <PageHeader eyebrow="Transaction detail" title={formatMoney(item.amount, item.currency)} description={`Created ${formatDate(item.createdAt, true)}`} action={<Link to="/transactions" className="btn-secondary"><ArrowLeft size={16} /> Transactions</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CircleDollarSign size={24} /></div><div><p className="text-sm text-muted">Payment status</p><p className="font-bold">{humanize(item.status)}</p></div></div>
            <StatusBadge status={item.status} />
          </div>
          <div className="grid gap-6 py-7 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Customer</p><div className="mt-3 flex gap-3"><UserRound size={19} className="text-muted" /><div><p className="text-sm font-semibold">{item.customerName || item.customer?.name || "Not provided"}</p><p className="text-sm text-muted">{item.customerEmail || item.customer?.email || "No email"}</p>{item.customer?._id ? <Link to={`/customers/${item.customer._id}`} className="mt-1 inline-block text-xs font-bold text-brand-700 hover:underline">View customer history</Link> : null}</div></div></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Payment method</p><p className="mt-3 text-sm font-semibold">{humanize(item.paymentMethodType || "Unknown")}</p></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-5">
            <h2 className="font-bold">Payment timeline</h2>
            <div className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
              <div><p className="text-sm font-semibold">Webhook record created</p><p className="text-xs text-muted">{formatDate(item.createdAt, true)}</p></div>
              {item.paidAt ? <div><p className="text-sm font-semibold">Payment succeeded</p><p className="text-xs text-muted">{formatDate(item.paidAt, true)}</p></div> : null}
              {item.failureMessage ? <div><p className="text-sm font-semibold text-red-700">Payment failed</p><p className="text-xs text-muted">{item.failureMessage}</p></div> : null}
              {item.refundedAt ? <div><p className="text-sm font-semibold">Refund reported</p><p className="text-xs text-muted">{formatDate(item.refundedAt, true)}</p></div> : null}
            </div>
          </div>
        </section>
        <aside className="space-y-5">
          <div className="card p-6">
            <h2 className="font-bold">Payment summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Gross amount</dt><dd className="font-bold">{formatMoney(item.amount, item.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Platform fee</dt><dd className="font-bold">{item.platformFee > 0 ? formatMoney(item.platformFee, item.currency) : "None configured"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Refunded</dt><dd className="font-bold">{formatMoney(item.refundedAmount, item.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Stripe processing fee</dt><dd className="font-bold">{item.feeStatus === "available" && item.stripeFee != null ? formatMoney(item.stripeFee, item.currency) : "Unavailable"}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-3"><dt className="text-muted">Net</dt><dd className="font-bold">{item.feeStatus === "available" && item.netAmount != null ? formatMoney(item.netAmount, item.currency) : "Unavailable"}</dd></div>
              {item.feeStatus !== "available" ? <div className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Stripe fee and net settlement data have not been synchronized for this payment.</div> : null}
            </dl>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Related link</h2>
            <Link to={`/payment-links/${item.paymentLink._id}`} className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-700">{item.paymentLink.title}<ExternalLink size={16} /></Link>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Stripe identifiers</h2>
            <dl className="mt-4 space-y-4 text-xs">{rows.map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 break-all font-mono">{value || "—"}</dd></div>)}</dl>
            <p className="mt-5 flex gap-2 text-xs leading-5 text-muted"><Clock3 size={15} className="shrink-0" /> Use these references when contacting Stripe support.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
