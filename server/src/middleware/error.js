import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { isProduction } from "../config/env.js";
import { logError } from "../utils/logger.js";

export const notFound = (req, _res, next) =>
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found`, 404, "NOT_FOUND"));

export const errorHandler = (error, _req, res, _next) => {
  let normalized = error;

  if (error instanceof ZodError) {
    normalized = new AppError("Please correct the highlighted fields", 422, "VALIDATION_ERROR", error.issues);
  } else if (error?.name === "ValidationError") {
    normalized = new AppError("The submitted data is invalid", 422, "VALIDATION_ERROR");
  } else if (error?.name === "MulterError") {
    normalized = new AppError(
      error.code === "LIMIT_FILE_SIZE" ? "The image must be 5 MB or smaller" : "The image upload is invalid",
      422,
      "INVALID_IMAGE"
    );
  } else if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    normalized = new AppError("The request body is not valid JSON", 400, "INVALID_JSON");
  } else if (error?.code === 11000) {
    normalized = new AppError("A record with those details already exists", 409, "DUPLICATE_RECORD");
  } else if (error?.name === "CastError") {
    normalized = new AppError("The requested record was not found", 404, "NOT_FOUND");
  } else if (error?.type?.startsWith?.("Stripe")) {
    normalized = new AppError(error.message || "Stripe could not complete the request", 502, "STRIPE_ERROR");
  } else if (!error?.isOperational) {
    normalized = new AppError("An unexpected server error occurred", 500);
  }

  if (!isProduction || normalized.statusCode >= 500) {
    logError("Request failed", error);
  }

  res.status(normalized.statusCode || 500).json({
    success: false,
    error: {
      code: normalized.code || "INTERNAL_ERROR",
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      ...(!isProduction && error?.stack ? { stack: error.stack } : {}),
    },
  });
};
