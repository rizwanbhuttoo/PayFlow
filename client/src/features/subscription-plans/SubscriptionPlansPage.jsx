import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import { api } from "../../lib/api";
import { useSearchParams } from "../../lib/router";
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

export default function SubscriptionPlansPage() {
  const [searchParams] = useSearchParams();
  const selectedCustomer = searchParams.get("customer");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [billingInterval, setBillingInterval] = useState("");
  const query = useQuery({
    queryKey: ["subscription-plans", search, status, billingInterval],
    queryFn: () =>
      api(
        `/subscription-plans?search=${encodeURIComponent(search)}&status=${status}&billingInterval=${billingInterval}`
      ),
  });
  const planPath = (planId) =>
    `/subscription-plans/${planId}${
      selectedCustomer ? `?customer=${encodeURIComponent(selectedCustomer)}` : ""
    }`;
  return (
    <>
      <PageHeader
        eyebrow="Recurring offers"
        title="Subscription plans"
        description="Create reusable monthly or yearly prices, then invite one saved customer at a time."
        action={
          <Link to="/subscription-plans/new" className="btn-primary">
            <Plus size={17} /> Create plan
          </Link>
        }
      />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <label className="relative">
          <span className="sr-only">Search plans</span>
          <Search
            size={17}
            className="absolute left-3 top-3 text-muted"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field pl-10"
            placeholder="Search plan or reference…"
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
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="field"
          value={billingInterval}
          onChange={(event) => setBillingInterval(event.target.value)}
          aria-label="Filter by billing interval"
        >
          <option value="">All intervals</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      {query.isLoading ? (
        <LoadingBlock rows={5} />
      ) : query.error ? (
        <Notice>{query.error.message}</Notice>
      ) : !query.data.items.length ? (
        <EmptyState
          icon={RefreshCcw}
          title="No subscription plans found"
          description={
            search || status || billingInterval
              ? "Try clearing your search or filters."
              : "Create your first monthly or yearly recurring plan."
          }
          action={
            !search && !status && !billingInterval ? (
              <Link to="/subscription-plans/new" className="btn-primary">
                <Plus size={16} /> Create subscription plan
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_.7fr_.6fr_.7fr_.6fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
            <span>Plan</span>
            <span>Price</span>
            <span>Interval</span>
            <span>Subscribers</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {query.data.items.map((plan) => (
              <div
                key={plan._id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_.7fr_.6fr_.7fr_.6fr_auto] lg:items-center lg:gap-4"
              >
                <div className="min-w-0">
                  <Link
                    to={planPath(plan._id)}
                    className="truncate text-sm font-bold hover:text-brand-600"
                  >
                    {plan.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted">
                    {plan.internalReference ||
                      `Created ${formatDate(plan.createdAt)}`}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatMoney(plan.amount, plan.currency)}
                </p>
                <p className="text-sm">
                  {formatBillingInterval(plan.billingInterval)}
                </p>
                <p className="text-sm font-semibold">
                  {plan.activeSubscriberCount} active{" "}
                  <span className="font-normal text-muted">
                    / {plan.totalSubscribers}
                  </span>
                </p>
                <div>
                  <StatusBadge status={plan.status} />
                </div>
                <div className="flex gap-2">
                  <Link
                    className="btn-secondary !p-2.5"
                    to={planPath(plan._id)}
                    aria-label="Open plan details"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
