import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";
import { Resend } from "resend";
import { env } from "./env.js";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey)
  : null;
export const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;
export { cloudinary };
