import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, jsonOptions } from "../../lib/api";
import { passwordSchema } from "../auth/schemas";
import { ButtonLoader, Field, Notice, PageHeader } from "../../components/ui";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export default function SettingsPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const submit = async ({ currentPassword, newPassword }) => {
    setMessage(""); setError("");
    try {
      await api("/users/password", jsonOptions("PATCH", { currentPassword, newPassword }));
      reset(); setMessage("Password changed successfully.");
    } catch (reason) { setError(reason.message); }
  };
  return (
    <>
      <PageHeader eyebrow="Account security" title="Settings" description="Manage your password and review your account’s security boundaries." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><KeyRound size={20} /></div><div><h2 className="font-bold">Change password</h2><p className="text-xs text-muted">Use a unique password you do not use elsewhere.</p></div></div>
          {(message || error) ? <div className="mb-5"><Notice type={message ? "success" : "info"}>{message || error}</Notice></div> : null}
          <form onSubmit={handleSubmit(submit)} className="max-w-xl space-y-5">
            <Field label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword} {...register("currentPassword")} />
            <Field label="New password" type="password" autoComplete="new-password" error={errors.newPassword} {...register("newPassword")} />
            <Field label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword} {...register("confirmPassword")} />
            <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? <ButtonLoader label="Updating…" /> : "Update password"}</button>
          </form>
        </section>
        <aside className="space-y-5">
          <div className="card p-6"><ShieldCheck className="text-emerald-600" size={24} /><h2 className="mt-4 font-bold">Protected by default</h2><p className="mt-2 text-sm leading-6 text-muted">Passwords use adaptive bcrypt hashing. Reset and verification tokens are hashed and time-limited.</p></div>
          <div className="card p-6"><LockKeyhole className="text-brand-500" size={24} /><h2 className="mt-4 font-bold">Provider secrets</h2><p className="mt-2 text-sm leading-6 text-muted">Stripe, Resend, and Cloudinary credentials are used only by the API and never sent to this browser.</p></div>
        </aside>
      </div>
    </>
  );
}
