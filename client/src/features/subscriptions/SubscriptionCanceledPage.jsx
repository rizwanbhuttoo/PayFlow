import { ArrowLeft, XCircle } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";

export default function SubscriptionCanceledPage() {
  return (
    <AuthShell
      eyebrow="Stripe Checkout"
      title="Checkout canceled"
      description="No subscription was confirmed on this page."
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <XCircle className="mx-auto text-slate-500" size={34} />
        <h2 className="mt-4 text-lg font-bold">No recurring plan started</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          You can safely close this page or return to the subscription link
          when you are ready.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="btn-secondary mt-6"
        >
          <ArrowLeft size={16} /> Return
        </button>
      </div>
    </AuthShell>
  );
}
