import crypto from "node:crypto";
import { logInfo } from "../utils/logger.js";

export const requestContext = (req, res, next) => {
  const incomingId = req.get("X-Request-ID");
  req.requestId =
    incomingId && /^[A-Za-z0-9._-]{8,100}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();
  res.set("X-Request-ID", req.requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    logInfo("http_request", {
      requestId: req.requestId,
      userId: req.user?.id,
      operation: `${req.method} ${req.route?.path || req.path}`,
      durationMs: Date.now() - startedAt,
      result: res.statusCode,
    });
  });
  next();
};
