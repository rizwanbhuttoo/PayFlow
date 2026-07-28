import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useSearchParams } from "../../lib/router";
import { ArrowUpRight, RefreshCcw, Search } from "lucide-react";
import { api } from "../../lib/api";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from "../../lib/format";
import {
  EmptyState,
  LoadingBlock,
  Notice,
  PageHeader,
  StatusBadge,
} from "../../components/ui";

export default function SubscriptionsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState(searchParams.get("plan") || "");
  const [billingInterval, setBillingInterval] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidDateRange = Boolean(from && to && from > to);
  const plans = useQuery({
    queryKey: ["subscription-plans", "filter"],
    queryFn: () => api("/subscription-plans?limit=50"),
  });
  const query = useQuery({
    queryKey: [
      "subscriptions",
      search,
      status,
      plan,
      billingInterval,
      from,
      to,
    ],
    queryFn: () =>
      api(
        `/subscriptions?search=${encodeURIComponent(search)}&status=${status}&plan=${plan}&billingInterval=${billingInterval}&from=${from}&to=${to}`
      ),
    enabled: !invalidDateRange,
  });

  return (
    <>
      <PageHeader
        eyebrow="Recurring customers"
        title="Subscriptions"
        description="Customer agreements synchronized from Stripe Checkout, recurring invoices, and lifecycle webhooks."
      />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_.8fr_.8fr_.7fr_.7fr_.7fr]">
        <label className="relative">
          <span className="sr-only">Search subscriptions</span>
          <Search
            size={17}
            className="absolute left-3 top-3 text-muted"
          />
          <input
            className="field pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Customer or Stripe reference…"
          />
        </label>
        <select
          className="field"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="incomplete">Incomplete</option>
          <option value="past_due">Past due</option>
          <option value="unpaid">Unpaid</option>
          <option value="canceled">Canceled</option>
          <option value="incomplete_expired">Incomplete expired</option>
        </select>
        <select
          className="field"
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          aria-label="Filter by plan"
        >
          <option value="">All plans</option>
          {plans.data?.items.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={billingInterval}
          onChange={(event) => setBillingInterval(event.target.value)}
          aria-label="Filter by interval"
        >
          <option value="">All intervals</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          className="field"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="From date"
        />
        <input
          className="field"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-label="To date"
        />
      </div>
      {invalidDateRange ? (
        <Notice>The end date must not be earlier than the start date.</Notice>
      ) : null}
      {!invalidDateRange &&
        (query.isLoading ? (
          <LoadingBlock rows={5} />
        ) : query.error ? (
          <Notice>{query.error.message}</Notice>
        ) : !query.data.items.length ? (
          <EmptyState
            icon={RefreshCcw}
            title="No subscriptions found"
            description="Subscriptions appear after a customer completes a Stripe-hosted subscription checkout."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[1.2fr_1fr_.7fr_.65fr_.8fr_.7fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
              <span>Customer</span>
              <span>Plan</span>
              <span>Price</span>
              <span>Interval</span>
              <span>Period end</span>
              <span>Status</span>
              <span></span>
            </div>
            <div className="divide-y divide-slate-100">
              {query.data.items.map((item) => (
                <div
                  key={item._id}
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1fr_.7fr_.65fr_.8fr_.7fr_auto] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {item.customerName ||
                        item.customerEmail ||
                        "Stripe customer"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.customerEmail || item.stripeSubscriptionId}
                    </p>
                  </div>
                  <p className="truncate text-sm font-semibold">
                    {item.plan?.name || "Subscription plan"}
                  </p>
                  <p className="text-sm font-bold">
                    {formatMoney(item.amount, item.currency)}
                  </p>
                  <p className="text-sm">
                    {formatBillingInterval(item.billingInterval)}
                  </p>
                  <div>
                    <p className="text-sm">
                      {formatDate(item.currentPeriodEnd)}
                    </p>
                    {item.cancelAtPeriodEnd ? (
                      <p className="mt-1 text-xs font-semibold text-orange-700">
                        Cancels on this date
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <StatusBadge status={item.status} />
                  </div>
                  <Link
                    to={`/subscriptions/${item._id}`}
                    className="btn-secondary !p-2.5"
                    aria-label="View subscription"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
    </>
  );
}
