import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Link2, Plus, Search } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge } from "../../components/ui";

export default function PaymentLinksPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["payment-links", search, status],
    queryFn: () => api(`/payment-links?search=${encodeURIComponent(search)}&status=${status}`),
  });
  return (
    <>
      <PageHeader eyebrow="Collect payments" title="Payment requests" description="Create a customer-bound Stripe checkout for each known client." action={<Link to="/payment-links/new" className="btn-primary"><Plus size={17} /> New request</Link>} />
      <div className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row">
        <label className="relative flex-1"><span className="sr-only">Search links</span><Search size={17} className="absolute left-3 top-3 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-10" placeholder="Search title or reference…" /></label>
        <select className="field sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="inactive">Inactive</option><option value="expired">Expired</option>
        </select>
      </div>
      {query.isLoading ? <LoadingBlock rows={5} /> : query.error ? <Notice>{query.error.message}</Notice> : !query.data.items.length ? (
        <EmptyState icon={Link2} title="No payment requests found" description={search || status ? "Try clearing your search or filter." : "Add a customer, then create their first fixed-price payment request."} action={!search && !status ? <Link to="/payment-links/new" className="btn-primary"><Plus size={16} /> Create payment request</Link> : null} />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.3fr_1fr_.7fr_.7fr_.7fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted md:grid">
            <span>Payment request</span><span>Customer</span><span>Amount</span><span>Received</span><span>Status</span><span>Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {query.data.items.map((link) => (
              <div key={link._id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1fr_.7fr_.7fr_.7fr_auto] md:items-center md:gap-4">
                <div className="min-w-0"><Link to={`/payment-links/${link._id}`} className="truncate text-sm font-bold hover:text-brand-600">{link.title}</Link><p className="mt-1 truncate text-xs text-muted">{link.internalReference || `Created ${formatDate(link.createdAt)}`}</p></div>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{link.customer?.name || "Legacy request"}</p><p className="truncate text-xs text-muted">{link.customer?.email || link.intendedRecipientEmail || "Unassigned"}</p></div>
                <div><p className="text-xs text-muted md:hidden">Amount</p><p className="text-sm font-semibold">{formatMoney(link.amount, link.currency)}</p></div>
                <div><p className="text-xs text-muted md:hidden">Received</p><p className="text-sm font-semibold">{formatMoney(link.totalReceived, link.currency)} <span className="font-normal text-muted">({link.paymentCount})</span></p></div>
                <div><StatusBadge status={link.status} /></div>
                <div className="flex gap-2">
                  <Link className="btn-secondary !p-2.5" to={`/payment-links/${link._id}`} aria-label="Open details"><ArrowUpRight size={16} /></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
