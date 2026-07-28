import { Redirect, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { LoaderCircle } from "lucide-react";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f8fc] text-brand-500"><LoaderCircle className="animate-spin" size={30} /></div>;
  }
  return user ? children : <Redirect to={{ pathname: "/login", state: { from: location } }} />;
}
