import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Link2,
  Plus,
  RefreshCcw,
  TriangleAlert,
  WalletCards,
  UsersRound,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { LoadingBlock, Notice, PageHeader, StatusBadge } from "../../components/ui";

const summaryCards = [
  { key: "successfulPayments", label: "Successful payments", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  { key: "failedPayments", label: "Failed payments", icon: TriangleAlert, color: "text-red-600 bg-red-50" },
  { key: "activeLinks", label: "Active requests", icon: Link2, color: "text-brand-600 bg-brand-50" },
  { key: "totalLinks", label: "Total requests", icon: WalletCards, color: "text-blue-600 bg-blue-50" },
];

const subscriptionCards = [
  { key: "activeSubscriptions", label: "Active subscriptions", color: "text-emerald-600 bg-emerald-50" },
  { key: "pastDueSubscriptions", label: "Past-due subscriptions", color: "text-orange-600 bg-orange-50" },
  { key: "canceledSubscriptions", label: "Canceled subscriptions", color: "text-slate-600 bg-slate-100" },
  { key: "failedRecurringPayments", label: "Failed recurring payments", color: "text-red-600 bg-red-50" },
];

const customerCards = [
  ["totalCustomers", "Total customers"],
  ["newCustomers", "New this month"],
  ["returningCustomers", "Returning this month"],
  ["customersWithActiveSubscriptions", "With active subscriptions"],
  ["customersWithFailedPayments", "Require payment attention"],
];

function MoneyTotals({ items, empty = "—" }) {
  if (!items?.length) return <p className="mt-1 text-xl font-extrabold">{empty}</p>;
  return (
    <div className="mt-1 space-y-1">
      {items.map((item) => (
        <p key={item.currency || item._id} className="text-xl font-extrabold tracking-tight">
          {formatMoney(item.amount, item.currency || item._id)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [summary, recent, alerts] = await Promise.all([
        api("/dashboard/summary"),
        api("/dashboard/recent"),
        api("/dashboard/alerts"),
      ]);
      return { ...summary, ...recent, ...alerts };
    },
  });
  if (isLoading) return <LoadingBlock rows={6} />;
  if (error) return <Notice>{error.message}</Notice>;
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Your payment workspace"
        description="A clear view of incoming payments, active requests, and your Stripe connection."
        action={<Link to="/payment-links/new" className="btn-primary"><Plus size={17} /> New payment request</Link>}
      />
      {!data.stripeAccount?.chargesEnabled ? (
        <div className="mb-6">
          <Notice>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span><strong>Finish connecting Stripe.</strong> Payment requests become available after Stripe enables charges.</span>
              <Link to="/stripe" className="font-bold underline underline-offset-2">Review connection</Link>
            </div>
          </Notice>
        </div>
      ) : null}
      {data.operationalAlerts?.webhookDeadLetters ||
      data.operationalAlerts?.failedEmails ? (
        <div className="mb-6">
          <Notice>
            <strong>Background work requires attention.</strong>{" "}
            {data.operationalAlerts.webhookDeadLetters || 0} dead-letter webhook
            event(s) and {data.operationalAlerts.failedEmails || 0} failed email
            delivery record(s) are awaiting operational review.
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card p-5 sm:col-span-2 xl:col-span-1">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-[#ecfdf5] text-emerald-600"><CircleDollarSign size={21} /></div>
          <p className="text-xs font-semibold text-muted">Total received</p>
          {data.summary.totals.length ? (
            <div className="mt-1 space-y-1">
              {data.summary.totals.map((total) => (
                <p key={total._id} className="text-xl font-extrabold tracking-tight">{formatMoney(total.amount, total._id)}</p>
              ))}
            </div>
          ) : <p className="mt-1 text-2xl font-extrabold tracking-tight">—</p>}
        </div>
        {summaryCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="card p-5">
            <div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={20} /></div>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{data.summary[key]}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-bold">Recent transactions</h2><p className="text-xs text-muted">Latest webhook activity</p></div>
            <Link to="/transactions" className="flex items-center gap-1 text-xs font-bold text-brand-600">View all <ArrowUpRight size={14} /></Link>
          </div>
          {data.recentTransactions.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentTransactions.map((item) => (
                <Link to={`/transactions/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><CircleDollarSign size={18} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customerEmail || "Stripe customer"}</p><p className="truncate text-xs text-muted">{item.paymentLink?.title || "Payment link"} · {formatDate(item.createdAt)}</p></div>
                  <div className="text-right"><p className="text-sm font-bold">{formatMoney(item.amount, item.currency)}</p><StatusBadge status={item.status} /></div>
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-muted">Transactions will appear after Stripe sends a payment event.</p>}
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-bold">Recent links</h2><p className="text-xs text-muted">Your latest requests</p></div>
            <Link to="/payment-links" className="flex items-center gap-1 text-xs font-bold text-brand-600">View all <ArrowUpRight size={14} /></Link>
          </div>
          {data.recentLinks.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentLinks.map((item) => (
                <Link to={`/payment-links/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Link2 size={17} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-xs text-muted">{formatMoney(item.amount, item.currency)}</p></div>
                  <StatusBadge status={item.status} />
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-muted">No payment requests yet.</p>}
        </section>
      </div>
      <div className="mb-5 mt-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-600">
            Customer health
          </p>
          <h2 className="mt-1 text-xl font-bold">Unified customers</h2>
        </div>
        <Link to="/customers" className="btn-secondary">
          View customers <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {customerCards.map(([key, label]) => (
          <div key={key} className="card p-5">
            <div className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <UsersRound size={18} />
            </div>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold">
              {data.customerSummary?.[key] || 0}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-10 mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-600">Recurring billing</p>
          <h2 className="mt-1 text-xl font-bold">Subscription overview</h2>
        </div>
        <Link to="/subscription-plans/new" className="btn-secondary"><Plus size={16} /> New plan</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {subscriptionCards.map(({ key, label, color }) => (
          <div key={key} className="card p-5">
            <div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl ${color}`}><RefreshCcw size={20} /></div>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{data.subscriptionSummary[key]}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-semibold text-muted">Monthly recurring estimate</p>
          <MoneyTotals items={data.subscriptionSummary.monthlyEstimates} />
          <p className="mt-2 text-xs text-muted">Active monthly plans only</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-muted">Yearly recurring estimate</p>
          <MoneyTotals items={data.subscriptionSummary.yearlyEstimates} />
          <p className="mt-2 text-xs text-muted">Active yearly plans only</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-muted">Recurring revenue collected</p>
          <MoneyTotals items={data.subscriptionSummary.recurringRevenue} />
          <p className="mt-2 text-xs text-muted">Paid invoices only</p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-bold">Recent subscriptions</h2><p className="text-xs text-muted">Latest customer agreements</p></div>
            <Link to="/subscriptions" className="flex items-center gap-1 text-xs font-bold text-brand-600">View all <ArrowUpRight size={14} /></Link>
          </div>
          {data.recentSubscriptions.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentSubscriptions.map((item) => (
                <Link to={`/subscriptions/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><RefreshCcw size={17} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customerName || item.customerEmail || "Stripe customer"}</p><p className="truncate text-xs text-muted">{item.plan?.name || "Subscription plan"} · {formatDate(item.currentPeriodEnd)}</p></div>
                  <StatusBadge status={item.status} />
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-muted">No subscriptions yet.</p>}
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-bold">Recent recurring payments</h2><p className="text-xs text-muted">Latest Stripe invoices</p></div>
            <Link to="/subscription-invoices" className="flex items-center gap-1 text-xs font-bold text-brand-600">View all <ArrowUpRight size={14} /></Link>
          </div>
          {data.recentRecurringPayments.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentRecurringPayments.map((item) => (
                <Link to={`/subscription-invoices/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.subscription?.customerEmail || item.plan?.name || "Stripe invoice"}</p><p className="truncate text-xs text-muted">{formatDate(item.createdAt, true)}</p></div>
                  <p className="text-sm font-bold">{formatMoney(item.amountPaid || item.amountDue, item.currency)}</p>
                  <StatusBadge status={item.paymentStatus} />
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-muted">No recurring invoice events yet.</p>}
        </section>
      </div>
      {data.failedRecurringPayments.length || data.scheduledCancellations.length ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Payments requiring attention</h2><p className="text-xs text-muted">Failed or authentication-required invoices</p></div>
            {data.failedRecurringPayments.length ? <div className="divide-y divide-slate-100">{data.failedRecurringPayments.map((item) => <Link to={`/subscription-invoices/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-red-50"><TriangleAlert size={17} className="text-red-600" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.subscription?.customerEmail || item.plan?.name}</p><p className="text-xs text-muted">{item.failureMessage || "Payment requires attention"}</p></div><StatusBadge status={item.paymentStatus} /></Link>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted">No failed recurring payments.</p>}
          </section>
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Scheduled cancellations</h2><p className="text-xs text-muted">Subscriptions ending after their paid period</p></div>
            {data.scheduledCancellations.length ? <div className="divide-y divide-slate-100">{data.scheduledCancellations.map((item) => <Link to={`/subscriptions/${item._id}`} key={item._id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customerEmail || item.plan?.name}</p><p className="text-xs text-muted">Cancels {formatDate(item.currentPeriodEnd)}</p></div><StatusBadge status={item.status} /></Link>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted">No scheduled cancellations.</p>}
          </section>
        </div>
      ) : null}
    </>
  );
}
