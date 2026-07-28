import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { ButtonLoader, Field, Notice } from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { forgotSchema } from "./schemas";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotSchema) });
  const submit = async (values) => {
    setApiError("");
    try {
      const data = await api("/auth/forgot-password", jsonOptions("POST", values));
      setMessage("If that email belongs to an account, a reset link is on its way.");
      if (data?.developmentResetToken) {
        navigate(`/reset-password?token=${data.developmentResetToken}`);
      }
    } catch (error) {
      setApiError(error.message);
    }
  };
  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" description="We’ll email you a secure, one-time reset link.">
      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        {message ? <Notice type="success">{message}</Notice> : null}
        {apiError ? <Notice>{apiError}</Notice> : null}
        <Field label="Email address" type="email" autoComplete="email" error={errors.email} {...register("email")} />
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? <ButtonLoader label="Sending…" /> : "Send reset link"}</button>
      </form>
      <Link to="/login" className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={15} /> Back to sign in</Link>
    </AuthShell>
  );
}
