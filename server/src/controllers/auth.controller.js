import { User } from "../models/User.js";
import { Token } from "../models/Token.js";
import { AppError } from "../utils/AppError.js";
import { createOpaqueToken, hashToken, signAccessToken } from "../utils/security.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.service.js";
import { isProduction } from "../config/env.js";

const issueStoredToken = async (userId, type, ttlMs) => {
  const token = createOpaqueToken();
  await Token.deleteMany({ user: userId, type });
  await Token.create({
    user: userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
};

export const register = async (req, res) => {
  const exists = await User.exists({ email: req.body.email });
  if (exists) throw new AppError("An account with this email already exists", 409, "EMAIL_IN_USE");

  const passwordHash = await User.hashPassword(req.body.password);
  const user = await User.create({ ...req.body, password: undefined, passwordHash });
  const token = await issueStoredToken(user.id, "email_verification", 24 * 60 * 60 * 1000);

  try {
    await sendVerificationEmail({ user, token });
  } catch (error) {
    await User.findByIdAndDelete(user.id);
    await Token.deleteMany({ user: user.id });
    throw error;
  }

  res.status(201).json({
    success: true,
    message: "Account created. Check your email to verify it.",
    data: {
      email: user.email,
      ...(!isProduction ? { developmentVerificationToken: token } : {}),
    },
  });
};

export const verifyEmail = async (req, res) => {
  const record = await Token.findOneAndDelete({
    tokenHash: hashToken(req.body.token),
    type: "email_verification",
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw new AppError("This verification link is invalid or expired", 400, "INVALID_TOKEN");

  const user = await User.findByIdAndUpdate(
    record.user,
    { isEmailVerified: true },
    { new: true, runValidators: true }
  );
  res.json({
    success: true,
    message: "Email verified successfully",
    data: { user, token: signAccessToken(user.id) },
  });
};

export const login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+passwordHash");
  const valid = user && (await user.verifyPassword(req.body.password));
  if (!valid) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  if (user.status !== "active") throw new AppError("This account is blocked", 403, "ACCOUNT_BLOCKED");
  if (!user.isEmailVerified) {
    throw new AppError("Verify your email before signing in", 403, "EMAIL_NOT_VERIFIED");
  }
  res.json({ success: true, data: { user, token: signAccessToken(user.id) } });
};

export const forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  let developmentResetToken;
  if (user?.status === "active") {
    const token = await issueStoredToken(user.id, "password_reset", 60 * 60 * 1000);
    developmentResetToken = token;
    try {
      await sendPasswordResetEmail({ user, token });
    } catch {
      // Keep the public response identical so provider failures cannot reveal accounts.
      developmentResetToken = undefined;
    }
  }
  res.json({
    success: true,
    message: "If an account exists, a reset link has been sent.",
    ...(!isProduction && developmentResetToken ? { data: { developmentResetToken } } : {}),
  });
};

export const resetPassword = async (req, res) => {
  const record = await Token.findOneAndDelete({
    tokenHash: hashToken(req.body.token),
    type: "password_reset",
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw new AppError("This reset link is invalid or expired", 400, "INVALID_TOKEN");

  const passwordHash = await User.hashPassword(req.body.password);
  await User.findByIdAndUpdate(record.user, { passwordHash }, { runValidators: true });
  await Token.deleteMany({ user: record.user });
  res.json({ success: true, message: "Password updated. You can now sign in." });
};

export const getMe = async (req, res) =>
  res.json({ success: true, data: { user: req.user } });

export const logout = async (_req, res) =>
  res.json({ success: true, message: "Signed out" });
