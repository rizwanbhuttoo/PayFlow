import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  ExternalLink,
  ReceiptText,
  Settings2,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  api,
  idempotentJsonOptions,
  jsonOptions,
  newIdempotencyKey,
} from "../../lib/api";
import { getSafeExternalUrl } from "../../lib/browser";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
  humanize,
} from "../../lib/format";
import {
  ButtonLoader,
  LoadingBlock,
  Modal,
  Notice,
  PageHeader,
  StatusBadge,
  TextareaField,
} from "../../components/ui";

const cancellationSchema = z.object({
  type: z.enum(["period_end", "immediate"]),
  reason: z.string().max(500).optional(),
  confirmed: z.literal(true, {
    error: "Confirm the cancellation to continue",
  }),
});

function CancellationModal({ subscription, onClose, onCanceled }) {
  const [apiError, setApiError] = useState("");
  const [operationKey] = useState(newIdempotencyKey);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(cancellationSchema),
    defaultValues: {
      type: "period_end",
      reason: "",
      confirmed: false,
    },
  });
  const type = useWatch({ control, name: "type" });
  const submit = async (values) => {
    setApiError("");
    try {
      await api(
        `/subscriptions/${subscription._id}/cancel`,
        idempotentJsonOptions("POST", values, operationKey)
      );
      await onCanceled();
      onClose();
    } catch (error) {
      setApiError(error.message);
    }
  };

  return (
    <Modal title="Cancel subscription" onClose={onClose}>
      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        {apiError ? <Notice>{apiError}</Notice> : null}
        <fieldset>
          <legend className="label">Cancellation timing</legend>
          <div className="space-y-3">
            <label className="flex gap-3 rounded-xl border border-slate-200 p-4">
              <input
                type="radio"
                value="period_end"
                {...register("type")}
              />
              <span>
                <span className="block text-sm font-bold">
                  At the end of the billing period
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Customer access continues through{" "}
                  {formatDate(subscription.currentPeriodEnd)}. This is the
                  recommended option.
                </span>
              </span>
            </label>
            <label className="flex gap-3 rounded-xl border border-red-200 p-4">
              <input
                type="radio"
                value="immediate"
                {...register("type")}
              />
              <span>
                <span className="block text-sm font-bold text-red-700">
                  Cancel immediately
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Billing ends now. This does not create a refund or prorated
                  credit.
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        {type === "immediate" ? (
          <Notice>
            Immediate cancellation is destructive and does not automatically
            refund the latest payment.
          </Notice>
        ) : null}
        <TextareaField
          label="Internal cancellation reason"
          placeholder="Optional note for your records…"
          error={errors.reason}
          {...register("reason")}
        />
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            {...register("confirmed")}
          />
          <span>
            I confirm this cancellation action.
            {errors.confirmed ? (
              <span className="mt-1 block text-xs text-red-600">
                {errors.confirmed.message}
              </span>
            ) : null}
          </span>
        </label>
        <button
          className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ButtonLoader label="Updating Stripe…" />
          ) : type === "immediate" ? (
            "Cancel immediately"
          ) : (
            "Schedule cancellation"
          )}
        </button>
      </form>
    </Modal>
  );
}

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancellation, setShowCancellation] = useState(false);
  const [actionError, setActionError] = useState("");
  const query = useQuery({
    queryKey: ["subscription", id],
    queryFn: () => api(`/subscriptions/${id}`),
  });
  const resume = useMutation({
    mutationFn: () =>
      api(`/subscriptions/${id}/resume`, jsonOptions("POST")),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription", id] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
    onError: (error) => setActionError(error.message),
  });
  const portal = useMutation({
    mutationFn: () =>
      api(`/subscriptions/${id}/portal`, jsonOptions("POST")),
    onSuccess: ({ url }) => {
      const safeUrl = getSafeExternalUrl(url);
      if (safeUrl) window.location.assign(safeUrl);
      else setActionError("Stripe returned an invalid portal URL.");
    },
    onError: (error) => setActionError(error.message),
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription", id] }),
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
      queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.error) return <Notice>{query.error.message}</Notice>;
  const { subscription, invoices } = query.data;
  const canCancel = !["canceled", "incomplete_expired"].includes(
    subscription.status
  );

  return (
    <>
      <PageHeader
        eyebrow="Subscription detail"
        title={
          subscription.customerName ||
          subscription.customerEmail ||
          "Stripe customer"
        }
        description={`${subscription.plan.name} · ${formatMoney(subscription.amount, subscription.currency)} ${subscription.billingInterval === "yearly" ? "per year" : "per month"}`}
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />
      {actionError ? (
        <div className="mb-5">
          <Notice>{actionError}</Notice>
        </div>
      ) : null}
      {subscription.cancelAtPeriodEnd ? (
        <div className="mb-5">
          <Notice>
            <strong>Cancellation scheduled.</strong> This subscription remains{" "}
            {humanize(subscription.status)} through{" "}
            {formatDate(subscription.currentPeriodEnd)}.
          </Notice>
        </div>
      ) : null}
      {["past_due", "unpaid"].includes(subscription.status) ? (
        <div className="mb-5">
          <Notice>
            Payment attention is required. Stripe controls retry timing; use
            the Customer Portal to update the payment method.
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <CalendarClock size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted">Subscription status</p>
                  <p className="font-bold">{humanize(subscription.status)}</p>
                </div>
              </div>
              <StatusBadge status={subscription.status} />
            </div>
            <div className="grid gap-6 py-7 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Customer
                </p>
                <div className="mt-3 flex gap-3">
                  <UserRound size={19} className="text-muted" />
                  <div>
                    <p className="text-sm font-semibold">
                      {subscription.customer?.name ||
                        subscription.customerName ||
                        "Not provided"}
                    </p>
                    <p className="text-sm text-muted">
                      {subscription.customer?.email ||
                        subscription.customerEmail ||
                        "No email"}
                    </p>
                    {subscription.customer?.phone ? (
                      <p className="text-sm text-muted">
                        {subscription.customer.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Billing
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {formatMoney(subscription.amount, subscription.currency)} ·{" "}
                  {formatBillingInterval(subscription.billingInterval)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(subscription.currentPeriodStart)} –{" "}
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <h2 className="font-bold">Subscription timeline</h2>
              <div className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
                <div>
                  <p className="text-sm font-semibold">Subscription created</p>
                  <p className="text-xs text-muted">
                    {formatDate(subscription.createdAt, true)}
                  </p>
                </div>
                {subscription.cancelAtPeriodEnd ? (
                  <div>
                    <p className="text-sm font-semibold text-orange-700">
                      Cancellation scheduled
                    </p>
                    <p className="text-xs text-muted">
                      Cancels on {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                ) : null}
                {subscription.canceledAt ? (
                  <div>
                    <p className="text-sm font-semibold">Canceled by Stripe</p>
                    <p className="text-xs text-muted">
                      {formatDate(subscription.canceledAt, true)}
                    </p>
                  </div>
                ) : null}
                {subscription.endedAt ? (
                  <div>
                    <p className="text-sm font-semibold">Subscription ended</p>
                    <p className="text-xs text-muted">
                      {formatDate(subscription.endedAt, true)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold">Payment history</h2>
                <p className="text-xs text-muted">
                  Webhook-verified recurring invoices
                </p>
              </div>
              <Link
                to={`/subscription-invoices?subscription=${subscription._id}`}
                className="text-xs font-bold text-brand-600"
              >
                View all
              </Link>
            </div>
            {invoices.length ? (
              <div className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <Link
                    to={`/subscription-invoices/${invoice._id}`}
                    key={invoice._id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                  >
                    <ReceiptText size={18} className="text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {invoice.invoiceNumber || invoice.stripeInvoiceId}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(invoice.createdAt, true)}
                      </p>
                    </div>
                    <p className="text-sm font-bold">
                      {formatMoney(
                        invoice.amountPaid || invoice.amountDue,
                        invoice.currency
                      )}
                    </p>
                    <StatusBadge status={invoice.paymentStatus} />
                    <ArrowUpRight size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-5 py-12 text-center text-sm text-muted">
                Stripe invoice events will appear here.
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <div className="card p-6">
            <h2 className="font-bold">Manage subscription</h2>
            <button
              className="btn-primary mt-4 w-full"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              {portal.isPending ? (
                <ButtonLoader label="Opening portal…" />
              ) : (
                <>
                  <Settings2 size={16} /> Open Customer Portal
                </>
              )}
            </button>
            <p className="mt-3 text-xs leading-5 text-muted">
              Stripe creates a new short-lived portal session for invoices,
              payment methods, and self-service cancellation.
            </p>
            {subscription.cancelAtPeriodEnd ? (
              <button
                className="btn-secondary mt-3 w-full"
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
              >
                {resume.isPending ? "Removing schedule…" : "Keep subscription"}
              </button>
            ) : canCancel ? (
              <button
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
                onClick={() => setShowCancellation(true)}
              >
                <XCircle size={16} /> Cancel subscription
              </button>
            ) : null}
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Plan</h2>
            <Link
              to={`/subscription-plans/${subscription.plan._id}`}
              className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-700"
            >
              {subscription.plan.name}
              <ExternalLink size={16} />
            </Link>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Stripe identifiers</h2>
            <dl className="mt-4 space-y-4 text-xs">
              {[
                ["Subscription", subscription.stripeSubscriptionId],
                ["Customer", subscription.stripeCustomerId],
                ["Product", subscription.stripeProductId],
                ["Price", subscription.stripePriceId],
                ["Latest invoice", subscription.latestStripeInvoiceId],
                [
                  "Latest payment intent",
                  subscription.latestStripePaymentIntentId,
                ],
                ["Connected account", subscription.stripeAccountId],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 break-all font-mono">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
      {showCancellation ? (
        <CancellationModal
          subscription={subscription}
          onClose={() => setShowCancellation(false)}
          onCanceled={refresh}
        />
      ) : null}
    </>
  );
}
