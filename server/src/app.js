import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import paymentLinkRoutes from "./routes/paymentLink.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriptionPlanRoutes from "./routes/subscriptionPlan.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import subscriptionInvoiceRoutes from "./routes/subscriptionInvoice.routes.js";
import subscriptionCheckoutRoutes from "./routes/subscriptionCheckout.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requestContext } from "./middleware/requestContext.js";
import mongoose from "mongoose";

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestContext);
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Stripe-Signature",
      "Idempotency-Key",
      "X-Request-ID",
    ],
  })
);

app.use("/api/webhooks", webhookRoutes);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.get("/api/health", (_req, res) =>
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } })
);
app.get("/api/readiness", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? "ready" : "not_ready",
      database: ready ? "connected" : "disconnected",
      providers: {
        stripe: Boolean(env.stripeSecretKey && env.stripeWebhookSecret),
        email: Boolean(env.resendApiKey),
        cloudinary: Boolean(
          env.cloudinaryCloudName &&
            env.cloudinaryApiKey &&
            env.cloudinaryApiSecret
        ),
      },
      timestamp: new Date().toISOString(),
    },
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/payment-links", paymentLinkRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/subscription-checkout", subscriptionCheckoutRoutes);
app.use("/api/subscription-plans", subscriptionPlanRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/subscription-invoices", subscriptionInvoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(notFound);
app.use(errorHandler);
