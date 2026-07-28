import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const createOpaqueToken = () => crypto.randomBytes(32).toString("hex");
export const hashToken = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

export const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
