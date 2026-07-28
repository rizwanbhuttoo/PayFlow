import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from "../validation/schemas.js";
import {
  forgotPassword,
  getMe,
  login,
  logout,
  register,
  resetPassword,
  verifyEmail,
} from "../controllers/auth.controller.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
});

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(login));
router.post("/verify-email", authLimiter, validate(tokenSchema), asyncHandler(verifyEmail));
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, logout);

export default router;
