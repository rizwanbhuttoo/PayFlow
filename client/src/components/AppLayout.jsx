import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  ChevronDown,
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCcw,
  Settings,
  UserRound,
  WalletCards,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useNavigate } from "../lib/router";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: UsersRound },
  { to: "/payment-links", label: "Payment requests", icon: Link2 },
  { to: "/transactions", label: "One-time payments", icon: CreditCard },
  { to: "/subscription-plans", label: "Subscription plans", icon: RefreshCcw },
  { to: "/subscriptions", label: "Subscriptions", icon: WalletCards },
  { to: "/subscription-invoices", label: "Recurring payments", icon: ReceiptText },
  { to: "/stripe", label: "Stripe account", icon: WalletCards },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
        <Link2 size={19} strokeWidth={2.5} />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-ink">PayFlow</span>
    </Link>
  );
}

function SidebarContent({ close }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => {
    logout();
    navigate("/login");
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center border-b border-slate-100 px-5"><Logo /></div>
      <nav className="flex-1 space-y-1.5 p-3" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-ink"
            activeClassName="nav-active"
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <ChevronDown size={15} className="text-muted" />
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700">
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppLayout({ children }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="relative h-full w-[280px] bg-white shadow-2xl">
            <button className="absolute right-3 top-4 z-10 rounded-lg p-2 text-muted hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            <SidebarContent close={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-7">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold text-muted">Workspace</p>
            <p className="text-sm font-bold">Personal payments</p>
          </div>
          <Link to="/profile" className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : <CircleUserRound size={30} className="text-brand-500" />}
            <span className="hidden text-sm font-semibold sm:block">{user?.firstName}</span>
          </Link>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
