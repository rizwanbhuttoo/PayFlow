import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import { AuthShell } from "../../components/AuthShell";
import { ButtonLoader, Field, Notice } from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { loginSchema } from "./schemas";

export default function LoginPage() {
  const [apiError, setApiError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });
  const submit = async (values) => {
    setApiError("");
    try {
      const data = await api("/auth/login", jsonOptions("POST", values));
      login(data);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (error) {
      setApiError(error.message);
    }
  };
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to PayFlow" description="Use your verified account to manage payment requests.">
      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        {apiError ? <Notice>{apiError}</Notice> : null}
        <Field label="Email address" type="email" autoComplete="email" error={errors.email} {...register("email")} />
        <div>
          <div className="mb-1 flex justify-end"><Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline">Forgot password?</Link></div>
          <Field label="Password" type="password" autoComplete="current-password" error={errors.password} {...register("password")} />
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? <ButtonLoader label="Signing in…" /> : "Sign in"}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">New to PayFlow? <Link className="font-bold text-brand-600 hover:underline" to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
