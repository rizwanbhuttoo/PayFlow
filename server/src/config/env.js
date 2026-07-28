import dotenv from "dotenv";

dotenv.config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env" });
dotenv.config({ path: "../.env" });

const nodeEnv = process.env.NODE_ENV || "development";
const port = Number(process.env.PORT || 5000);
const stripeFeePercent = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT || 0);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const serverUrl = process.env.SERVER_URL || "http://localhost:5000";
const jwtSecret =
  process.env.JWT_SECRET || "development-only-secret-change-before-production";

const requiredInProduction = [
  "MONGODB_URI",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM_ADDRESS",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

if (
  !Number.isFinite(stripeFeePercent) ||
  stripeFeePercent < 0 ||
  stripeFeePercent > 100
) {
  throw new Error("STRIPE_PLATFORM_FEE_PERCENT must be between 0 and 100");
}

if (nodeEnv === "production") {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (jwtSecret.length < 32 || jwtSecret.includes("development-only")) {
    throw new Error("JWT_SECRET must contain at least 32 non-default characters");
  }
  const publicUrls = {
    CLIENT_URL: clientUrl,
    SERVER_URL: serverUrl,
    STRIPE_CONNECT_RETURN_URL: process.env.STRIPE_CONNECT_RETURN_URL,
    STRIPE_CONNECT_REFRESH_URL: process.env.STRIPE_CONNECT_REFRESH_URL,
  };
  for (const [name, value] of Object.entries(publicUrls)) {
    if (!value?.startsWith("https://")) {
      throw new Error(`${name} must use HTTPS in production`);
    }
  }
}

export const env = {
  nodeEnv,
  port,
  clientUrl,
  serverUrl,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/payflow",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeReturnUrl:
    process.env.STRIPE_CONNECT_RETURN_URL || "http://localhost:5173/stripe/return",
  stripeRefreshUrl:
    process.env.STRIPE_CONNECT_REFRESH_URL || "http://localhost:5173/stripe/refresh",
  stripeFeePercent,
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFromName: process.env.EMAIL_FROM_NAME || "PayFlow",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "payflow/profiles",
};

export const isProduction = env.nodeEnv === "production";
