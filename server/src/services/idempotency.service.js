import crypto from "node:crypto";
import { IdempotencyOperation } from "../models/IdempotencyOperation.js";
import { AppError } from "../utils/AppError.js";

const stableJson = (value) => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === undefined) return '"__undefined__"';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const hashRequest = (input) =>
  crypto.createHash("sha256").update(stableJson(input)).digest("hex");

export const requireIdempotencyKey = (req) => {
  const key = req.get("Idempotency-Key")?.trim();
  if (!key || key.length > 200) {
    throw new AppError(
      "A valid Idempotency-Key header is required",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }
  return key;
};

export const beginIdempotentOperation = async ({
  user,
  operationType,
  idempotencyKey,
  input,
}) => {
  const requestHash = hashRequest(input);
  let operation = await IdempotencyOperation.findOne({
    user,
    operationType,
    idempotencyKey,
  }).select("+requestHash");

  if (operation) {
    if (operation.requestHash !== requestHash) {
      throw new AppError(
        "This idempotency key was already used with a different request",
        409,
        "IDEMPOTENCY_CONFLICT"
      );
    }
    return { operation, replay: operation.status === "completed" };
  }

  try {
    operation = await IdempotencyOperation.create({
      user,
      operationType,
      idempotencyKey,
      requestHash,
    });
    return { operation, replay: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    operation = await IdempotencyOperation.findOne({
      user,
      operationType,
      idempotencyKey,
    }).select("+requestHash");
    if (operation?.requestHash !== requestHash) {
      throw new AppError(
        "This idempotency key was already used with a different request",
        409,
        "IDEMPOTENCY_CONFLICT"
      );
    }
    return { operation, replay: operation?.status === "completed" };
  }
};

export const stripeIdempotencyOptions = (operation, stage, stripeAccount) => ({
  stripeAccount,
  idempotencyKey: `payflow:${operation.operationType}:${operation.idempotencyKey}:${stage}`,
});

export const failIdempotentOperation = async (operation, error) => {
  operation.status = "failed";
  operation.errorMessage = String(error?.message || error).slice(0, 1000);
  await operation.save();
};
