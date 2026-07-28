import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Mail,
  Share2,
  Unlink,
} from "lucide-react";
import { api, jsonOptions } from "../../lib/api";
import {
  copyText,
  getSafeExternalUrl,
  shareContent,
} from "../../lib/browser";
import { formatDate, formatMoney } from "../../lib/format";
import {
  ButtonLoader,
  LoadingBlock,
  Modal,
  Notice,
  PageHeader,
  StatusBadge,
  Field,
  TextareaField,
} from "../../components/ui";

const emailSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(160),
  message: z.string().max(2000).optional(),
});

function EmailModal({ link, onClose }) {
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { subject: `Payment request: ${link.title}`, message: "" },
  });
  const submit = async (values) => {
    setApiError("");
    try {
      await api(`/payment-links/${link._id}/email`, jsonOptions("POST", values));
      setSent(true);
    } catch (error) { setApiError(error.message); }
  };
  return (
    <Modal title="Send payment request" onClose={onClose}>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Mail size={25} /></div>
          <h3 className="mt-4 text-lg font-bold">Email queued</h3>
          <p className="mt-2 text-sm text-muted">The background delivery worker will send your payment request.</p>
          <button onClick={onClose} className="btn-primary mt-6">Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          {apiError ? <Notice>{apiError}</Notice> : null}
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-bold">{link.customer?.name || "Customer"}</p>
            <p className="mt-1 text-muted">{link.customer?.email}</p>
          </div>
          <Field label="Subject" error={errors.subject} {...register("subject")} />
          <TextareaField label="Personal message" placeholder="Here is the payment request we discussed…" error={errors.message} {...register("message")} />
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? <ButtonLoader label="Sending…" /> : <><Mail size={16} /> Send with Resend</>}</button>
        </form>
      )}
    </Modal>
  );
}

export default function PaymentLinkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [showEmail, setShowEmail] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const query = useQuery({ queryKey: ["payment-link", id], queryFn: () => api(`/payment-links/${id}`) });
  const transactions = useQuery({ queryKey: ["payment-link-transactions", id], queryFn: () => api(`/payment-links/${id}/transactions`) });
  const deactivate = useMutation({
    mutationFn: () => api(`/payment-links/${id}/deactivate`, jsonOptions("PATCH")),
    onSuccess: () => {
      setConfirmDeactivate(false);
      client.invalidateQueries({ queryKey: ["payment-link", id] });
      client.invalidateQueries({ queryKey: ["payment-links"] });
      client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.error) return <Notice>{query.error.message}</Notice>;
  const link = query.data.link;
  const safePublicUrl = getSafeExternalUrl(link.publicUrl);
  const copy = async () => {
    const didCopy = await copyText(link.publicUrl);
    setCopied(didCopy);
    setCopyNotice(
      didCopy
        ? "Customer checkout URL copied."
        : "Clipboard access is unavailable. Select the checkout URL and copy it manually."
    );
  };
  const share = async () => {
    const result = await shareContent({
      title: link.title,
      text: `${link.title} — ${formatMoney(link.amount, link.currency)}`,
      url: link.publicUrl,
    });
    if (result === "unsupported") {
      await copy();
    } else if (result === "shared") {
      setCopyNotice("Customer checkout shared.");
    } else if (result === "failed") {
      setCopyNotice("Sharing failed. Copy the checkout URL instead.");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Payment request"
        title={link.title}
        description={link.internalReference || `Created ${formatDate(link.createdAt)}`}
        action={<button onClick={() => navigate(-1)} className="btn-secondary"><ArrowLeft size={16} /> Back</button>}
      />
      {deactivate.error ? <div className="mb-5"><Notice>{deactivate.error.message}</Notice></div> : null}
      {copyNotice ? <div className="mb-5"><Notice type={copied ? "success" : "info"}>{copyNotice}</Notice></div> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Payment amount</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{formatMoney(link.amount, link.currency)}</p></div>
              <StatusBadge status={link.status} />
            </div>
            {link.description ? <p className="mt-6 border-t border-slate-100 pt-6 text-sm leading-6 text-muted">{link.description}</p> : null}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1 text-xs font-semibold text-muted">Customer-bound Stripe checkout</p>
              <p className="mb-2 text-xs text-muted">Created only for {link.customer?.email || "the assigned customer"}; do not forward it to another person.</p>
              <div className="flex gap-2"><input readOnly value={link.publicUrl} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" /><button onClick={copy} className="btn-secondary !py-2"><Copy size={15} /> {copied ? "Copied" : "Copy"}</button></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button disabled={link.status !== "active" || !link.customer} onClick={() => setShowEmail(true)} className="btn-secondary"><Mail size={16} /> Email customer</button>
              {safePublicUrl ? <a href={safePublicUrl} target="_blank" rel="noreferrer" className="btn-secondary">Open <ExternalLink size={16} /></a> : <button disabled className="btn-secondary">Open <ExternalLink size={16} /></button>}
              <button disabled={link.status !== "active"} onClick={share} className="btn-secondary"><Share2 size={16} /> Share</button>
            </div>
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold">Payments received</h2><p className="text-xs text-muted">{link.paymentCount} successful payment{link.paymentCount === 1 ? "" : "s"}</p></div><p className="font-extrabold">{formatMoney(link.totalReceived, link.currency)}</p></div>
            {transactions.isLoading ? <div className="p-5"><LoadingBlock rows={2} /></div> : transactions.error ? <div className="p-5"><Notice>{transactions.error.message}</Notice></div> : transactions.data?.items.length ? (
              <div className="divide-y divide-slate-100">
                {transactions.data.items.map((item) => (
                  <Link to={`/transactions/${item._id}`} key={item._id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customerEmail || "Stripe customer"}</p><p className="text-xs text-muted">{formatDate(item.createdAt, true)}</p></div>
                    <p className="text-sm font-bold">{formatMoney(item.amount, item.currency)}</p><StatusBadge status={item.status} /><ArrowUpRight size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
            ) : <p className="px-5 py-12 text-center text-sm text-muted">No Stripe payment events for this link yet.</p>}
          </section>
        </div>
        <aside className="space-y-5">
          <div className="card p-6">
            <h2 className="font-bold">Performance</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Payments</dt><dd className="font-bold">{link.paymentCount}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Retained</dt><dd className="font-bold">{link.retainedPaymentCount || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Fully refunded</dt><dd className="font-bold">{link.refundedPaymentCount || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Partially refunded</dt><dd className="font-bold">{link.partiallyRefundedPaymentCount || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Total received</dt><dd className="font-bold">{formatMoney(link.totalReceived, link.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Expires</dt><dd className="font-bold">{formatDate(link.expiresAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Customer</dt><dd className="max-w-48 text-right font-bold">{link.customer ? <Link to={`/customers/${link.customer._id}`} className="text-brand-700 hover:underline">{link.customer.name || link.customer.email}</Link> : "Legacy unassigned link"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="max-w-48 truncate font-bold">{link.customer?.email || link.intendedRecipientEmail || "—"}</dd></div>
            </dl>
          </div>
          <div className="card p-6">
            <h2 className="font-bold">Stripe identifiers</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div><dt className="text-muted">{link.stripeCheckoutSessionId ? "Checkout session" : "Legacy payment link"}</dt><dd className="mt-1 break-all font-mono">{link.stripeCheckoutSessionId || link.stripePaymentLinkId || "—"}</dd></div>
              <div><dt className="text-muted">Product</dt><dd className="mt-1 break-all font-mono">{link.stripeProductId}</dd></div>
              <div><dt className="text-muted">Price</dt><dd className="mt-1 break-all font-mono">{link.stripePriceId}</dd></div>
            </dl>
          </div>
          {link.status === "active" ? <button onClick={() => setConfirmDeactivate(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50"><Unlink size={16} /> Deactivate request</button> : null}
        </aside>
      </div>
      {showEmail ? <EmailModal link={link} onClose={() => setShowEmail(false)} /> : null}
      {confirmDeactivate ? (
        <Modal title="Deactivate payment request?" onClose={() => setConfirmDeactivate(false)}>
          <p className="text-sm leading-6 text-muted">The Stripe checkout URL will stop accepting payments. Historical transactions remain available and this cannot be reactivated in the MVP.</p>
          <div className="mt-6 flex justify-end gap-3"><button className="btn-secondary" onClick={() => setConfirmDeactivate(false)}>Cancel</button><button className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>{deactivate.isPending ? "Deactivating…" : "Deactivate"}</button></div>
        </Modal>
      ) : null}
    </>
  );
}
