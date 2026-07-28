import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import { AuthShell } from "../../components/AuthShell";
import { ButtonLoader, Field, Notice } from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { registerSchema } from "./schemas";

export default function RegisterPage() {
  const [apiError, setApiError] = useState("");
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
  });
  const submit = async (values) => {
    setApiError("");
    try {
      const data = await api("/auth/register", jsonOptions("POST", values));
      navigate("/verify-email", { state: { email: data.email, token: data.developmentVerificationToken } });
    } catch (error) {
      setApiError(error.message);
    }
  };
  return (
    <AuthShell eyebrow="Start collecting" title="Create your account" description="Set up your secure payment-link workspace in a few minutes.">
      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        {apiError ? <Notice>{apiError}</Notice> : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" autoComplete="given-name" error={errors.firstName} {...register("firstName")} />
          <Field label="Last name" autoComplete="family-name" error={errors.lastName} {...register("lastName")} />
        </div>
        <Field label="Email address" type="email" autoComplete="email" error={errors.email} {...register("email")} />
        <Field label="Password" type="password" autoComplete="new-password" hint="8+ characters with uppercase, lowercase, and a number" error={errors.password} {...register("password")} />
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? <ButtonLoader label="Creating account…" /> : "Create account"}</button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">Already registered? <Link className="font-bold text-brand-600 hover:underline" to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
