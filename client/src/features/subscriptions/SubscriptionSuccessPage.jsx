import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "../../lib/router";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  MailCheck,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { LoadingBlock, Notice, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { getSafeExternalUrl } from "../../lib/browser";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from "../../lib/format";

export default function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan") || "";
  const sessionId = searchParams.get("session_id") || "";
  const validParams =
    /^[a-f\d]{24}$/i.test(planId) && /^cs_/.test(sessionId);
  const query = useQuery({
    queryKey: ["subscription-checkout", planId, sessionId],
    queryFn: () =>
      api(`/subscription-checkout/${planId}/sessions/${sessionId}`),
    enabled: validParams,
    refetchInterval: (result) => {
      const checkout = result.state.data?.checkout;
      return checkout?.syncStatus === "synced" &&
        ["active", "canceled", "incomplete_expired"].includes(checkout.status)
        ? false
        : 5000;
    },
  });
  return (
    <AuthShell
      eyebrow="Stripe Checkout"
      title="Subscription received"
      description="Stripe and PayFlow are confirming the subscription through verified billing state and webhooks."
    >
      {!validParams ? (
        <Notice>
          This checkout confirmation link is incomplete or invalid.
        </Notice>
      ) : query.isLoading ? (
        <LoadingBlock rows={4} />
      ) : query.error ? (
        <Notice>{query.error.message}</Notice>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <CheckCircle2 className="text-emerald-700" size={28} />
            <h2 className="mt-3 text-lg font-bold text-emerald-950">
              {query.data.checkout.paymentStatus === "paid"
                ? "Payment successful"
                : "Checkout completed"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {query.data.plan.successMessage ||
                "The webhook-backed subscription record may take a moment to finish synchronizing."}
            </p>
            <p className="mt-2 text-xs font-semibold text-emerald-800">
              {query.data.checkout.syncStatus === "synced"
                ? "Subscription saved to the PayFlow portal."
                : "Payment is confirmed. PayFlow is finishing the portal sync automatically."}
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Plan
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  {query.data.plan.name}
                </h2>
              </div>
              <StatusBadge status={query.data.checkout.status} />
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Recurring price</dt>
                <dd className="font-bold">
                  {formatMoney(
                    query.data.plan.amount,
                    query.data.plan.currency
                  )}{" "}
                  · {formatBillingInterval(query.data.plan.billingInterval)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Customer email</dt>
                <dd className="max-w-56 truncate font-bold">
                  {query.data.checkout.customerEmail || "Provided to Stripe"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Next billing date</dt>
                <dd className="font-bold">
                  {formatDate(query.data.checkout.nextBillingDate)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <MailCheck size={18} />
              A private management link is sent to the verified email.
            </div>
            {getSafeExternalUrl(query.data.plan.redirectUrl) ? (
              <a
                href={query.data.plan.redirectUrl}
                className="btn-secondary flex-1"
                rel="noreferrer"
              >
                Return <ExternalLink size={16} />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => window.close()}
                className="btn-secondary flex-1"
              >
                Close <CalendarClock size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
