import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/security.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError("Your session is invalid or has expired", 401, "INVALID_TOKEN");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active") {
    throw new AppError("This account is unavailable", 403, "ACCOUNT_UNAVAILABLE");
  }

  req.user = user;
  next();
});
