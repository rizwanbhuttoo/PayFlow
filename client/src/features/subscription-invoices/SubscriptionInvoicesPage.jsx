import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useSearchParams } from "../../lib/router";
import { ArrowUpRight, ReceiptText, Search } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import {
  EmptyState,
  LoadingBlock,
  Notice,
  PageHeader,
  StatusBadge,
} from "../../components/ui";

export default function SubscriptionInvoicesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const subscription = searchParams.get("subscription") || "";
  const plan = searchParams.get("plan") || "";
  const invalidDateRange = Boolean(from && to && from > to);
  const query = useQuery({
    queryKey: [
      "subscription-invoices",
      search,
      paymentStatus,
      invoiceStatus,
      subscription,
      plan,
      from,
      to,
    ],
    queryFn: () =>
      api(
        `/subscription-invoices?search=${encodeURIComponent(search)}&paymentStatus=${paymentStatus}&invoiceStatus=${invoiceStatus}&subscription=${subscription}&plan=${plan}&from=${from}&to=${to}`
      ),
    enabled: !invalidDateRange,
  });

  return (
    <>
      <PageHeader
        eyebrow="Stripe Billing activity"
        title="Recurring payments"
        description="Invoices and payment outcomes synchronized from subscription webhooks. Only paid invoices count as collected revenue."
      />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_.8fr_.8fr_.7fr_.7fr]">
        <label className="relative">
          <span className="sr-only">Search invoices</span>
          <Search
            size={17}
            className="absolute left-3 top-3 text-muted"
          />
          <input
            className="field pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Invoice or Stripe reference…"
          />
        </label>
        <select
          className="field"
          value={paymentStatus}
          onChange={(event) => setPaymentStatus(event.target.value)}
          aria-label="Filter by payment status"
        >
          <option value="">All payment statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="action_required">Action required</option>
        </select>
        <select
          className="field"
          value={invoiceStatus}
          onChange={(event) => setInvoiceStatus(event.target.value)}
          aria-label="Filter by invoice status"
        >
          <option value="">All invoice statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="uncollectible">Uncollectible</option>
          <option value="void">Void</option>
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
            icon={ReceiptText}
            title="No recurring invoices found"
            description="Stripe invoice events will appear after a customer starts a subscription."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[1fr_1fr_.7fr_.7fr_.8fr_.8fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
              <span>Customer</span>
              <span>Plan</span>
              <span>Due</span>
              <span>Paid</span>
              <span>Invoice</span>
              <span>Payment</span>
              <span></span>
            </div>
            <div className="divide-y divide-slate-100">
              {query.data.items.map((invoice) => (
                <div
                  key={invoice._id}
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1fr_.7fr_.7fr_.8fr_.8fr_auto] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {invoice.subscription?.customerName ||
                        invoice.subscription?.customerEmail ||
                        "Stripe customer"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(invoice.createdAt, true)}
                    </p>
                  </div>
                  <p className="truncate text-sm font-semibold">
                    {invoice.plan?.name || "Subscription plan"}
                  </p>
                  <p className="text-sm font-bold">
                    {formatMoney(invoice.amountDue, invoice.currency)}
                  </p>
                  <p className="text-sm font-bold">
                    {formatMoney(invoice.amountPaid, invoice.currency)}
                  </p>
                  <div>
                    <StatusBadge status={invoice.invoiceStatus} />
                  </div>
                  <div>
                    <StatusBadge status={invoice.paymentStatus} />
                  </div>
                  <Link
                    to={`/subscription-invoices/${invoice._id}`}
                    className="btn-secondary !p-2.5"
                    aria-label="View invoice"
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
