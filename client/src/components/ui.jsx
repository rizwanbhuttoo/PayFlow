import { useEffect, useId, useRef } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { humanize } from "../lib/format";

export function Field({ label, error, hint, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <input
        className={`field ${error ? "field-error" : ""}`}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error.message}</span> : null}
      {hint && !error ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function SelectField({ label, error, children, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <select
        className={`field ${error ? "field-error" : ""}`}
        aria-invalid={error ? "true" : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-600">{error.message}</span> : null}
    </label>
  );
}

export function TextareaField({ label, error, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <textarea
        className={`field min-h-28 resize-y ${error ? "field-error" : ""}`}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error.message}</span> : null}
    </label>
  );
}

const badgeColors = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  incomplete: "bg-amber-50 text-amber-700 ring-amber-600/20",
  past_due: "bg-orange-50 text-orange-700 ring-orange-600/20",
  action_required: "bg-orange-50 text-orange-700 ring-orange-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  expired: "bg-slate-100 text-slate-600 ring-slate-500/20",
  canceled: "bg-slate-100 text-slate-600 ring-slate-500/20",
  incomplete_expired: "bg-slate-100 text-slate-600 ring-slate-500/20",
  void: "bg-slate-100 text-slate-600 ring-slate-500/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  unpaid: "bg-red-50 text-red-700 ring-red-600/20",
  uncollectible: "bg-red-50 text-red-700 ring-red-600/20",
  restricted: "bg-red-50 text-red-700 ring-red-600/20",
  refunded: "bg-violet-50 text-violet-700 ring-violet-600/20",
  partially_refunded: "bg-violet-50 text-violet-700 ring-violet-600/20",
  not_started: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeColors[status] || badgeColors.inactive}`}>
      {humanize(status)}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-brand-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }) {
  return (
    <div className="card space-y-4 p-6" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-10 rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon ? <div className="mb-4 rounded-2xl bg-brand-50 p-3 text-brand-600"><Icon size={24} /></div> : null}
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Notice({ type = "info", children }) {
  const success = type === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex gap-3 rounded-xl border p-4 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      <Icon className="mt-0.5 shrink-0" size={18} /> <div>{children}</div>
    </div>
  );
}

export function ButtonLoader({ label = "Working…" }) {
  return <><LoaderCircle size={16} className="animate-spin" /> {label}</>;
}

export function Modal({ title, children, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
