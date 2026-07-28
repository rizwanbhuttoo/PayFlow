import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, ReceiptText, Search } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge } from "../../components/ui";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidDateRange = Boolean(from && to && from > to);
  const query = useQuery({
    queryKey: ["transactions", search, status, from, to],
    queryFn: () => api(`/transactions?search=${encodeURIComponent(search)}&status=${status}&from=${from}&to=${to}`),
    enabled: !invalidDateRange,
  });
  return (
    <>
      <PageHeader eyebrow="Stripe activity" title="Transactions" description="Verified payment events received through your Stripe Connect account." />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_180px_170px_170px]">
        <label className="relative"><span className="sr-only">Search transactions</span><Search size={17} className="absolute left-3 top-3 text-muted" /><input className="field pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email or Stripe reference…" /></label>
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option>
        </select>
        <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
        <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
      </div>
      {invalidDateRange ? <Notice>The end date must not be earlier than the start date.</Notice> : null}
      {!invalidDateRange && (query.isLoading ? <LoadingBlock rows={5} /> : query.error ? <Notice>{query.error.message}</Notice> : !query.data.items.length ? (
        <EmptyState icon={ReceiptText} title="No transactions found" description="Successful and failed Stripe payment events will appear here after webhook processing." />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.2fr_1fr_.7fr_.7fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted md:grid">
            <span>Customer</span><span>Payment link</span><span>Amount</span><span>Status</span><span></span>
          </div>
          <div className="divide-y divide-slate-100">
            {query.data.items.map((item) => (
              <div key={item._id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_.7fr_.7fr_auto] md:items-center md:gap-4">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{item.customerEmail || "Stripe customer"}</p><p className="mt-1 text-xs text-muted">{formatDate(item.createdAt, true)}</p></div>
                <p className="truncate text-sm font-semibold">{item.paymentLink?.title || "Payment link"}</p>
                <p className="text-sm font-bold">{formatMoney(item.amount, item.currency)}</p>
                <div><StatusBadge status={item.status} /></div>
                <Link to={`/transactions/${item._id}`} className="btn-secondary !p-2.5" aria-label="View transaction"><ArrowUpRight size={16} /></Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
