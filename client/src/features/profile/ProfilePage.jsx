import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Cloud, MailCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { api, jsonOptions } from "../../lib/api";
import { ButtonLoader, Field, Notice, PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/format";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
});

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });
  const submit = async (values) => {
    setError(""); setMessage("");
    try {
      const data = await api("/users/profile", jsonOptions("PATCH", values));
      updateUser(data.user); setMessage("Profile details updated.");
    } catch (reason) { setError(reason.message); }
  };
  const upload = async (event) => {
    const image = event.target.files?.[0];
    if (!image) return;
    setUploading(true); setError(""); setMessage("");
    const body = new FormData();
    body.append("image", image);
    try {
      const data = await api("/users/profile-image", { method: "POST", body });
      updateUser(data.user); setMessage("Profile image uploaded to Cloudinary.");
    } catch (reason) { setError(reason.message); }
    finally { setUploading(false); }
  };
  return (
    <>
      <PageHeader eyebrow="Personal details" title="Your profile" description="Keep your sender identity and Cloudinary-hosted profile image current." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card p-6 sm:p-8">
          {(message || error) ? <div className="mb-5"><Notice type={message ? "success" : "info"}>{message || error}</Notice></div> : null}
          <div className="mb-8 flex flex-col items-center gap-5 border-b border-slate-100 pb-8 sm:flex-row">
            <div className="relative">
              {user.profileImageUrl ? <img src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} className="h-24 w-24 rounded-2xl object-cover shadow-sm" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-brand-50 text-brand-500"><UserRound size={42} /></div>}
              <label className="absolute -bottom-2 -right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white bg-brand-500 text-white shadow-lg hover:bg-brand-600" title="Upload profile image">
                <Camera size={16} /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} disabled={uploading} />
              </label>
            </div>
            <div><h2 className="font-bold">Profile image</h2><p className="mt-1 text-sm leading-6 text-muted">{uploading ? "Optimizing and uploading…" : "JPEG, PNG, or WebP. Maximum 5 MB."}</p><p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-brand-600"><Cloud size={14} /> Stored and transformed by Cloudinary</p></div>
          </div>
          <form onSubmit={handleSubmit(submit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" autoComplete="given-name" error={errors.firstName} {...register("firstName")} />
              <Field label="Last name" autoComplete="family-name" error={errors.lastName} {...register("lastName")} />
            </div>
            <Field label="Email address" value={user.email} disabled />
            <div className="flex justify-end border-t border-slate-100 pt-5"><button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? <ButtonLoader label="Saving…" /> : "Save changes"}</button></div>
          </form>
        </section>
        <aside className="space-y-5">
          <div className="card p-6">
            <MailCheck className="text-emerald-600" size={23} />
            <h2 className="mt-4 font-bold">Verified email</h2>
            <p className="mt-2 break-all text-sm text-muted">{user.email}</p>
          </div>
          <div className="card p-6 text-sm">
            <h2 className="font-bold">Account details</h2>
            <dl className="mt-4 space-y-3"><div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="font-bold capitalize">{user.status}</dd></div><div className="flex justify-between"><dt className="text-muted">Member since</dt><dd className="font-bold">{formatDate(user.createdAt)}</dd></div></dl>
          </div>
        </aside>
      </div>
    </>
  );
}
