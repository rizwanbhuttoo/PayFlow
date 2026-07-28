import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, jsonOptions } from "../../lib/api";
import { useNavigate, useSearchParams } from "../../lib/router";
import {
  ButtonLoader,
  Field,
  Notice,
  PageHeader,
} from "../../components/ui";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().max(40).optional(),
});

const safeReturnPath = (value) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "";

export default function NewCustomerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });
  const mutation = useMutation({
    mutationFn: (values) => api("/customers", jsonOptions("POST", values)),
    onSuccess: async ({ customer }) => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(
        returnTo
          ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}customer=${customer._id}`
          : `/customers/${customer._id}`
      );
    },
    onError: (error) => setApiError(error.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Customer-first billing"
        title="Add customer"
        description="This customer record will be reused for one-time payments and subscriptions."
        action={
          <Link to="/customers" className="btn-secondary">
            <ArrowLeft size={16} /> Back to customers
          </Link>
        }
      />
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="card mx-auto max-w-2xl space-y-5 p-6 sm:p-8"
      >
        {apiError ? <Notice>{apiError}</Notice> : null}
        <Field label="Customer name" placeholder="Alex Morgan" error={errors.name} {...register("name")} />
        <Field label="Email" type="email" placeholder="alex@example.com" hint="One active customer record is allowed per normalized email." error={errors.email} {...register("email")} />
        <Field label="Phone" type="tel" placeholder="+1 555 0100" error={errors.phone} {...register("phone")} />
        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button className="btn-primary min-w-36" disabled={mutation.isPending}>
            {mutation.isPending ? <ButtonLoader label="Saving…" /> : "Save customer"}
          </button>
        </div>
      </form>
    </>
  );
}
