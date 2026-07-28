import { Link } from "react-router-dom";
import { ArrowLeft, Link2Off } from "lucide-react";

export default function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f7f8fc] p-6"><div className="max-w-md text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Link2Off size={30} /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-brand-600">404 · Not found</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">This link went missing.</h1><p className="mt-3 text-sm leading-6 text-muted">The page may have moved, or the address may be incomplete.</p><Link to="/dashboard" className="btn-primary mt-7"><ArrowLeft size={16} /> Back to dashboard</Link></div></main>;
}
