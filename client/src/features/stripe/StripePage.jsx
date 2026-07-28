import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import { ArrowUpRight, Check, CircleDashed, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { api, jsonOptions } from "../../lib/api";
import { getSafeExternalUrl } from "../../lib/browser";
import { formatDate } from "../../lib/format";
import { ButtonLoader, LoadingBlock, Notice, PageHeader, StatusBadge } from "../../components/ui";

export default function StripePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handledPath = useRef("");
  const [navigationError, setNavigationError] = useState("");
  const status = useQuery({ queryKey: ["stripe-status"], queryFn: () => api("/stripe/status") });
  const refresh = useMutation({
    mutationFn: () => api("/stripe/refresh", jsonOptions("POST")),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stripe-status"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
  const openProviderUrl = (url) => {
    const safeUrl = getSafeExternalUrl(url);
    if (!safeUrl) {
      setNavigationError("Stripe returned an invalid navigation URL.");
      return;
    }
    window.location.assign(safeUrl);
  };
  const onboard = useMutation({
    mutationFn: () => api("/stripe/onboarding", jsonOptions("POST")),
    onSuccess: ({ url }) => openProviderUrl(url),
  });
  const dashboard = useMutation({
    mutationFn: () => api("/stripe/dashboard", jsonOptions("POST")),
    onSuccess: ({ url }) => openProviderUrl(url),
  });
  const refreshMutation = refresh.mutate;
  const onboardMutation = onboard.mutate;

  useEffect(() => {
    if (handledPath.current === location.pathname) return;
    handledPath.current = location.pathname;
    if (location.pathname === "/stripe/return") {
      refreshMutation(undefined, {
        onSettled: () => navigate("/stripe", { replace: true }),
      });
    } else if (location.pathname === "/stripe/refresh") {
      onboardMutation();
    }
  }, [location.pathname, navigate, onboardMutation, refreshMutation]);

  if (status.isLoading) return <LoadingBlock rows={5} />;
  const account = status.data?.account;
  const connected = account?.chargesEnabled;
  return (
    <>
      <PageHeader eyebrow="Payments infrastructure" title="Stripe account" description="Connect your Stripe Express account and keep its capabilities up to date." />
      {(status.error || refresh.error || onboard.error || dashboard.error || navigationError) ? <div className="mb-5"><Notice>{navigationError || (status.error || refresh.error || onboard.error || dashboard.error).message}</Notice></div> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#635bff] text-white shadow-lg shadow-brand-500/20"><WalletCards size={24} /></div>
              <div><h2 className="text-lg font-bold">Stripe Connect</h2><p className="mt-1 text-sm text-muted">{account ? `Account ${account.stripeAccountId}` : "No connected account yet"}</p></div>
            </div>
            <StatusBadge status={account?.onboardingStatus || "not_started"} />
          </div>
          <div className="my-7 h-px bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Details submitted", account?.detailsSubmitted],
              ["Charges enabled", account?.chargesEnabled],
              ["Payouts enabled", account?.payoutsEnabled],
            ].map(([label, enabled]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className={`mb-3 grid h-7 w-7 place-items-center rounded-full ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {enabled ? <Check size={15} strokeWidth={3} /> : <CircleDashed size={15} />}
                </div>
                <p className="text-xs font-semibold text-muted">{label}</p>
                <p className="mt-1 text-sm font-bold">{enabled ? "Ready" : "Not ready"}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {!connected ? <button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="btn-primary">{onboard.isPending ? <ButtonLoader /> : account ? "Continue onboarding" : "Connect Stripe"}</button> : null}
            {account ? <button onClick={() => refresh.mutate()} disabled={refresh.isPending} className="btn-secondary">{refresh.isPending ? <ButtonLoader label="Refreshing…" /> : <><RefreshCw size={16} /> Refresh status</>}</button> : null}
            {connected ? <button onClick={() => dashboard.mutate()} disabled={dashboard.isPending} className="btn-secondary">{dashboard.isPending ? <ButtonLoader /> : <>Open Stripe <ArrowUpRight size={16} /></>}</button> : null}
          </div>
        </section>
        <aside className="space-y-5">
          <div className="card p-6">
            <ShieldCheck className="text-brand-500" size={25} />
            <h2 className="mt-4 font-bold">Your financial data stays in Stripe</h2>
            <p className="mt-2 text-sm leading-6 text-muted">PayFlow stores only account capability flags and Stripe identifiers. Bank details, identity documents, and card data never enter this app.</p>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Account details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Country</dt><dd className="font-semibold uppercase">{account?.country || "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Default currency</dt><dd className="font-semibold uppercase">{account?.defaultCurrency || "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Connected</dt><dd className="font-semibold">{formatDate(account?.connectedAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Last checked</dt><dd className="font-semibold">{formatDate(account?.updatedAt, true)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
