import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Settings2 } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import {
  ButtonLoader,
  LoadingBlock,
  Notice,
  StatusBadge,
} from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { getSafeExternalUrl } from "../../lib/browser";
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from "../../lib/format";

export default function ManageSubscriptionPage() {
  const token = useMemo(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
    []
  );
  const summary = useQuery({
    queryKey: ["customer-management", token],
    queryFn: () =>
      api(
        "/subscription-checkout/manage/summary",
        jsonOptions("POST", { token })
      ),
    enabled: token.length >= 32,
    retry: false,
  });
  const portal = useMutation({
    mutationFn: () =>
      api(
        "/subscription-checkout/manage/portal",
        jsonOptions("POST", { token })
      ),
    onSuccess: ({ url }) => {
      const safeUrl = getSafeExternalUrl(url);
      if (safeUrl) {
        window.history.replaceState(null, "", "/manage-subscription");
        window.location.assign(safeUrl);
      }
    },
  });

  return (
    <AuthShell
      eyebrow="Private customer access"
      title="Manage subscription"
      description="This one-time link authorizes a short-lived Stripe customer portal session."
    >
      {!token ? (
        <Notice>This management link is incomplete.</Notice>
      ) : summary.isLoading ? (
        <LoadingBlock rows={4} />
      ) : summary.error ? (
        <Notice>{summary.error.message}</Notice>
      ) : (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Plan
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  {summary.data.plan.name}
                </h2>
              </div>
              <StatusBadge status={summary.data.subscription.status} />
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Recurring price</dt>
                <dd className="font-bold">
                  {formatMoney(
                    summary.data.plan.amount,
                    summary.data.plan.currency
                  )}{" "}
                  · {formatBillingInterval(summary.data.plan.billingInterval)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Customer email</dt>
                <dd className="font-bold">
                  {summary.data.subscription.customerEmail}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Current period ends</dt>
                <dd className="font-bold">
                  {formatDate(summary.data.subscription.currentPeriodEnd)}
                </dd>
              </div>
            </dl>
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
          >
            {portal.isPending ? (
              <ButtonLoader label="Opening secure portal…" />
            ) : (
              <>
                <Settings2 size={16} /> Open Stripe portal{" "}
                <ExternalLink size={15} />
              </>
            )}
          </button>
          {portal.error ? <Notice>{portal.error.message}</Notice> : null}
        </div>
      )}
    </AuthShell>
  );
}
