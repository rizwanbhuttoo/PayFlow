import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useSearchParams } from "../../lib/router";
import { AuthShell } from "../../components/AuthShell";
import { ButtonLoader, Field, Notice } from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { resetSchema } from "./schemas";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const token = params.get("token");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });
  const submit = async (values) => {
    setApiError("");
    try {
      await api("/auth/reset-password", jsonOptions("POST", { ...values, token }));
      setMessage("Your password is updated. You can sign in now.");
    } catch (error) { setApiError(error.message); }
  };
  return (
    <AuthShell eyebrow="Choose a new password" title="Secure your account" description="Your reset link is single-use and expires after one hour.">
      {message ? (
        <><Notice type="success">{message}</Notice><Link to="/login" className="btn-primary mt-5 w-full">Continue to sign in</Link></>
      ) : (
        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          {apiError ? <Notice>{apiError}</Notice> : null}
          {!token ? <Notice>This password-reset link is missing its secure token. Request a new link.</Notice> : null}
          <Field label="New password" type="password" autoComplete="new-password" error={errors.password} {...register("password")} />
          <button className="btn-primary w-full" disabled={isSubmitting || !token}>{isSubmitting ? <ButtonLoader /> : "Update password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
