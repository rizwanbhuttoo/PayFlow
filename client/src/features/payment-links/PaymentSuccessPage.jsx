import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function PaymentSuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="card max-w-lg p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto text-emerald-600" size={50} />
        <h1 className="mt-5 text-2xl font-extrabold">Payment submitted</h1>
        <p className="mt-3 leading-7 text-muted">
          Stripe is processing your payment. The business will receive the confirmed result securely.
        </p>
        <Link to="/login" className="btn-secondary mt-7">Return to PayFlow</Link>
      </section>
    </main>
  );
}
