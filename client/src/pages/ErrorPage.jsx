import { Link } from "react-router-dom";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorPage() {
  return <main className="grid min-h-[70vh] place-items-center p-6"><div className="max-w-md text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600"><TriangleAlert size={30} /></div><h1 className="mt-6 text-2xl font-extrabold">Something needs another try</h1><p className="mt-3 text-sm leading-6 text-muted">The page could not finish loading. Check your connection and try again.</p><Link to="/dashboard" className="btn-primary mt-7"><RefreshCw size={16} /> Return to dashboard</Link></div></main>;
}
