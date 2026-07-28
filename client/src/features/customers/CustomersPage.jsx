import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, UsersRound } from "lucide-react";
import {
  EmptyState,
  LoadingBlock,
  Notice,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";

const totals = (items = []) =>
  items.length
    ? items
        .map((item) => formatMoney(item.amount, item.currency))
        .join(" · ")
    : "—";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [attention, setAttention] = useState("");
  const query = useQuery({
    queryKey: ["customers", search, source, attention],
    queryFn: () =>
      api(
        `/customers?limit=50&search=${encodeURIComponent(search)}&source=${source}` +
          `${attention === "active" ? "&hasActiveSubscription=true" : ""}` +
          `${attention === "failed" ? "&hasFailedPayment=true" : ""}`
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="Unified customer history"
        title="Customers"
        description="Create each customer once, then reuse that record for one-time payments, subscriptions, invoices, and billing emails."
        action={<Link to="/customers/new" className="btn-primary"><Plus size={17} /> Add customer</Link>}
      />
      <form
        className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_190px_220px]"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-400"
          />
          <input
            className="field pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer name or email"
            aria-label="Search customers"
          />
        </label>
        <select
          className="field"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          <option value="one_time">One-time payment</option>
          <option value="subscription">Subscription</option>
          <option value="email">Email</option>
          <option value="import">Imported</option>
          <option value="manual">Manual</option>
        </select>
        <select
          className="field"
          value={attention}
          onChange={(event) => setAttention(event.target.value)}
          aria-label="Filter by customer state"
        >
          <option value="">All customer states</option>
          <option value="active">Has active subscription</option>
          <option value="failed">Has failed payment</option>
        </select>
      </form>
      {query.isLoading ? (
        <LoadingBlock rows={5} />
      ) : query.error ? (
        <Notice>{query.error.message}</Notice>
      ) : !query.data.items.length ? (
        <EmptyState
          icon={UsersRound}
          title="No customers yet"
          description="Add your first customer before creating a payment request or subscription invitation."
          action={<Link to="/customers/new" className="btn-primary"><Plus size={16} /> Add customer</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Sources</th>
                <th className="px-5 py-3">One-time</th>
                <th className="px-5 py-3">Recurring</th>
                <th className="px-5 py-3">Active plans</th>
                <th className="px-5 py-3">Last activity</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.items.map((customer) => (
                <tr key={customer._id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      to={`/customers/${customer._id}`}
                      className="font-bold text-brand-700 hover:underline"
                    >
                      {customer.name || customer.email || "Customer"}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {customer.email || "No email collected"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {(customer.sourceTypes || []).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{totals(customer.oneTimeTotals)}</p>
                    <p className="text-xs text-muted">
                      {customer.oneTimePaymentCount} payment(s)
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{totals(customer.recurringTotals)}</p>
                    <p className="text-xs text-muted">
                      {customer.recurringPaymentCount} invoice(s)
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {customer.activeSubscriptionCount}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {formatDate(customer.lastSeenAt, true)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={customer.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
