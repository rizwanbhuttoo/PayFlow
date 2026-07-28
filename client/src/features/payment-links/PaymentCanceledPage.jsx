import { XCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function PaymentCanceledPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="card max-w-lg p-8 text-center sm:p-10">
        <XCircle className="mx-auto text-slate-500" size={50} />
        <h1 className="mt-5 text-2xl font-extrabold">Payment canceled</h1>
        <p className="mt-3 leading-7 text-muted">
          No payment was completed. Ask the business for a new checkout if you still want to pay.
        </p>
        <Link to="/login" className="btn-secondary mt-7">Return to PayFlow</Link>
      </section>
    </main>
  );
}
