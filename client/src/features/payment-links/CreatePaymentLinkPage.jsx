import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "../../lib/router";
import { ArrowLeft, LockKeyhole, Plus } from "lucide-react";
import {
  api,
  idempotentJsonOptions,
  newIdempotencyKey,
} from "../../lib/api";
import { ButtonLoader, Field, Notice, PageHeader, SelectField, TextareaField } from "../../components/ui";
import { SUPPORTED_CURRENCIES } from "../../../../shared/domain";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().max(1000).optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero").max(999999999),
  currency: z.enum(SUPPORTED_CURRENCIES),
  internalReference: z.string().max(100).optional(),
  customer: z.string().regex(/^[a-f\d]{24}$/i, "Select a customer"),
  expiresAt: z
    .union([
      z.string().refine(
        (value) => {
          const expiresIn = Date.parse(value) - Date.now();
          return !Number.isNaN(expiresIn) &&
            expiresIn >= 30 * 60 * 1000 &&
            expiresIn <= 24 * 60 * 60 * 1000;
        },
        "Expiry must be between 30 minutes and 24 hours from now"
      ),
      z.literal(""),
    ])
    .optional(),
  redirectUrl: z.union([z.string().url("Enter a valid URL").refine((url) => url.startsWith("https://"), "Use an HTTPS URL"), z.literal("")]).optional(),
});

export default function CreatePaymentLinkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCustomerId = searchParams.get("customer") || "";
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const [operationKey] = useState(newIdempotencyKey);
  const stripeStatus = useQuery({ queryKey: ["stripe-status"], queryFn: () => api("/stripe/status") });
  const customers = useQuery({
    queryKey: ["customers", "payment-request-picker"],
    queryFn: () => api("/customers?limit=50"),
  });
  const selectedCustomer = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => api(`/customers/${selectedCustomerId}`),
    enabled: /^[a-f\d]{24}$/i.test(selectedCustomerId),
  });
  const customerOptions = [...(customers.data?.items || [])];
  if (
    selectedCustomer.data?.customer &&
    !customerOptions.some(
      (customer) => customer._id === selectedCustomer.data.customer._id
    )
  ) {
    customerOptions.unshift(selectedCustomer.data.customer);
  }
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "usd",
      amount: "",
      title: "",
      description: "",
      internalReference: "",
      customer: selectedCustomerId,
      expiresAt: "",
      redirectUrl: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (values) =>
      api(
        "/payment-links",
        idempotentJsonOptions(
          "POST",
          {
            ...values,
            amount: Math.round(values.amount * 100),
            expiresAt: values.expiresAt
              ? new Date(values.expiresAt).toISOString()
              : "",
          },
          operationKey
        )
      ),
    onSuccess: async ({ link }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment-links"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      navigate(`/payment-links/${link._id}`);
    },
    onError: (error) => setApiError(error.message),
  });
  const canCreate = stripeStatus.data?.account?.chargesEnabled;
  const hasCustomers = Boolean(customerOptions.length);
  return (
    <>
      <PageHeader eyebrow="New request" title="Create a payment request" description="Select a saved customer, set the amount, and create their secure Stripe checkout." action={<Link to="/payment-links" className="btn-secondary"><ArrowLeft size={16} /> Back to requests</Link>} />
      {stripeStatus.error ? <div className="mb-5"><Notice>{stripeStatus.error.message}</Notice></div> : null}
      {!stripeStatus.isLoading && !canCreate ? <div className="mb-5"><Notice><strong>Stripe isn’t ready.</strong> Complete onboarding and enable charges before creating a link. <Link to="/stripe" className="ml-1 font-bold underline">Connect Stripe</Link></Notice></div> : null}
      {customers.error ? <div className="mb-5"><Notice>{customers.error.message}</Notice></div> : null}
      {!customers.isLoading && !customers.error && !hasCustomers ? (
        <div className="mb-5">
          <Notice>
            <strong>Create a customer first.</strong> Every checkout is tied to one saved customer and one normalized email.{" "}
            <Link to="/customers/new?returnTo=/payment-links/new" className="font-bold underline">Add customer</Link>
          </Notice>
        </div>
      ) : null}
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card space-y-5 p-6 sm:p-8">
          {apiError ? <Notice>{apiError}</Notice> : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <SelectField label="Customer" error={errors.customer} {...register("customer")}>
              <option value="">Select a saved customer</option>
              {customerOptions.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name || "Customer"} — {customer.email}
                </option>
              ))}
            </SelectField>
            <Link to="/customers/new?returnTo=/payment-links/new" className="btn-secondary sm:mb-px">
              <Plus size={16} /> Add customer
            </Link>
          </div>
          <Field label="Payment title" placeholder="Website design deposit" error={errors.title} {...register("title")} />
          <TextareaField label="Description" placeholder="Describe what this payment covers…" error={errors.description} {...register("description")} />
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Amount" type="number" min="0.01" step="0.01" placeholder="250.00" error={errors.amount} {...register("amount")} />
            <SelectField label="Currency" error={errors.currency} {...register("currency")}>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>{currency.toUpperCase()}</option>
              ))}
            </SelectField>
          </div>
          <Field label="Internal reference" placeholder="PROJECT-104" error={errors.internalReference} {...register("internalReference")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expiry date" type="datetime-local" error={errors.expiresAt} {...register("expiresAt")} />
            <Field label="Redirect URL" type="url" placeholder="https://example.com/thanks" error={errors.redirectUrl} {...register("redirectUrl")} />
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button className="btn-primary min-w-40" disabled={!canCreate || !hasCustomers || mutation.isPending}>{mutation.isPending ? <ButtonLoader label="Creating…" /> : "Create payment request"}</button>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="card p-6">
            <LockKeyhole className="text-brand-500" size={23} />
            <h2 className="mt-4 font-bold">Stripe-hosted checkout</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Customers enter their payment details on Stripe. Card data never touches PayFlow’s servers.</p>
          </div>
          <div className="card p-6 text-sm">
            <h2 className="font-bold">Before you publish</h2>
            <ul className="mt-3 space-y-2 text-muted">
              <li>• Checkout is locked to the selected customer</li>
              <li>• Amount cannot be edited later</li>
              <li>• Checkout expires within 24 hours</li>
              <li>• Deactivation preserves payment history</li>
            </ul>
          </div>
        </aside>
      </form>
    </>
  );
}
