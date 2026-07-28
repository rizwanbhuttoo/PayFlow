import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useNavigate } from "../../lib/router";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import {
  api,
  idempotentJsonOptions,
  newIdempotencyKey,
} from "../../lib/api";
import {
  ButtonLoader,
  Field,
  Notice,
  PageHeader,
  SelectField,
  TextareaField,
} from "../../components/ui";
import {
  SUBSCRIPTION_BILLING_INTERVALS,
  SUPPORTED_CURRENCIES,
} from "../../../../shared/domain";

const schema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(120),
  description: z.string().max(1000).optional(),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero")
    .max(999999999),
  currency: z.enum(SUPPORTED_CURRENCIES),
  billingInterval: z.enum(SUBSCRIPTION_BILLING_INTERVALS),
  internalReference: z.string().max(100).optional(),
  successMessage: z.string().max(500).optional(),
  redirectUrl: z
    .union([
      z
        .string()
        .url("Enter a valid URL")
        .refine((url) => url.startsWith("https://"), "Use an HTTPS URL"),
      z.literal(""),
    ])
    .optional(),
});

export default function CreateSubscriptionPlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const [operationKey] = useState(newIdempotencyKey);
  const stripeStatus = useQuery({
    queryKey: ["stripe-status"],
    queryFn: () => api("/stripe/status"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      amount: "",
      currency: "usd",
      billingInterval: "monthly",
      internalReference: "",
      successMessage: "",
      redirectUrl: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (values) =>
      api(
        "/subscription-plans",
        idempotentJsonOptions(
          "POST",
          {
            ...values,
            amount: Math.round(values.amount * 100),
          },
          operationKey
        )
      ),
    onSuccess: async ({ plan }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      navigate(`/subscription-plans/${plan._id}`);
    },
    onError: (error) => setApiError(error.message),
  });
  const canCreate = stripeStatus.data?.account?.chargesEnabled;

  return (
    <>
      <PageHeader
        eyebrow="Recurring billing"
        title="Create a subscription plan"
        description="Create one fixed monthly or yearly price under your connected Stripe account."
        action={
          <Link to="/subscription-plans" className="btn-secondary">
            <ArrowLeft size={16} /> Back to plans
          </Link>
        }
      />
      {stripeStatus.error ? (
        <div className="mb-5">
          <Notice>{stripeStatus.error.message}</Notice>
        </div>
      ) : null}
      {!stripeStatus.isLoading && !canCreate ? (
        <div className="mb-5">
          <Notice>
            <strong>Stripe isn’t ready.</strong> Complete onboarding and enable
            charges before creating a recurring plan.{" "}
            <Link to="/stripe" className="font-bold underline">
              Connect Stripe
            </Link>
          </Notice>
        </div>
      ) : null}
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-6 xl:grid-cols-[1fr_340px]"
      >
        <div className="card space-y-5 p-6 sm:p-8">
          {apiError ? <Notice>{apiError}</Notice> : null}
          <Field
            label="Plan name"
            placeholder="Care plan"
            error={errors.name}
            {...register("name")}
          />
          <TextareaField
            label="Short description"
            placeholder="Explain what the customer receives each billing period…"
            error={errors.description}
            {...register("description")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Recurring amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="49.00"
              error={errors.amount}
              {...register("amount")}
            />
            <SelectField
              label="Currency"
              error={errors.currency}
              {...register("currency")}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency.toUpperCase()}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Billing interval"
              error={errors.billingInterval}
              {...register("billingInterval")}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </SelectField>
          </div>
          <Field
            label="Internal reference"
            placeholder="PLAN-SUPPORT-01"
            error={errors.internalReference}
            {...register("internalReference")}
          />
          <TextareaField
            label="Customer-facing success message"
            placeholder="Thanks for subscribing. We’ll be in touch shortly."
            error={errors.successMessage}
            {...register("successMessage")}
          />
          <Field
            label="Optional return URL"
            type="url"
            placeholder="https://example.com/account"
            hint="Shown as a return action after checkout. Must use HTTPS."
            error={errors.redirectUrl}
            {...register("redirectUrl")}
          />
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              className="btn-primary min-w-44"
              disabled={!canCreate || mutation.isPending}
            >
              {mutation.isPending ? (
                <ButtonLoader label="Creating plan…" />
              ) : (
                "Create subscription plan"
              )}
            </button>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="card p-6">
            <RefreshCcw className="text-brand-500" size={23} />
            <h2 className="mt-4 font-bold">Automatic recurring collection</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Stripe hosts checkout, saves the reusable payment method, creates
              invoices, and attempts future payments.
            </p>
          </div>
          <div className="card p-6 text-sm">
            <h2 className="font-bold">MVP plan rules</h2>
            <ul className="mt-3 space-y-2 text-muted">
              <li>• One product and price per plan</li>
              <li>• Monthly or yearly billing only</li>
              <li>• Existing subscriptions keep their original price</li>
              <li>• Deactivation only stops new subscriptions</li>
            </ul>
          </div>
        </aside>
      </form>
    </>
  );
}
