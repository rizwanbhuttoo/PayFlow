import crypto from "node:crypto";
import { CustomerManagementToken } from "../models/CustomerManagementToken.js";
import { AppError } from "../utils/AppError.js";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const tokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const issueCustomerManagementToken = async ({
  user,
  customer,
  subscription,
  stripeAccountId,
}) => {
  const token = crypto.randomBytes(32).toString("base64url");
  await CustomerManagementToken.updateMany(
    { subscription, usedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  await CustomerManagementToken.create({
    tokenHash: tokenHash(token),
    user,
    customer,
    subscription,
    stripeAccountId,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
};

export const consumeCustomerManagementToken = async (token) => {
  if (typeof token !== "string" || token.length < 32) {
    throw new AppError("Invalid management token", 401, "INVALID_MANAGEMENT_TOKEN");
  }
  const record = await CustomerManagementToken.findOneAndUpdate(
    {
      tokenHash: tokenHash(token),
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true }
  ).select("+tokenHash");
  if (!record) {
    throw new AppError(
      "This management link is invalid or expired",
      401,
      "INVALID_MANAGEMENT_TOKEN"
    );
  }
  return record;
};

export const verifyCustomerManagementToken = async (token) => {
  if (typeof token !== "string" || token.length < 32) {
    throw new AppError("Invalid management token", 401, "INVALID_MANAGEMENT_TOKEN");
  }
  const record = await CustomerManagementToken.findOne({
    tokenHash: tokenHash(token),
    usedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");
  if (!record) {
    throw new AppError(
      "This management link is invalid or expired",
      401,
      "INVALID_MANAGEMENT_TOKEN"
    );
  }
  return record;
};
