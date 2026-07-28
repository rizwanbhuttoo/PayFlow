import { Link2, ShieldCheck } from "lucide-react";

export function AuthShell({ eyebrow, title, description, children }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20"><Link2 size={20} /></span>
            <span className="text-xl font-extrabold tracking-tight">PayFlow</span>
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-600">{eyebrow}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-10 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={15} /> Payments handled securely by Stripe</p>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#15162d] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-28 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-bold text-brand-100">PAYMENT OPERATIONS, SIMPLIFIED</p>
          <h2 className="mt-5 max-w-lg text-4xl font-extrabold leading-tight tracking-tight">
            From payment request to paid — in one clear flow.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Connect Stripe, save your customers, send each one a secure hosted checkout, and track every payment.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {["Stripe Connect", "Resend email", "Live webhooks"].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-semibold backdrop-blur">{item}</div>
          ))}
        </div>
      </aside>
    </main>
  );
}
