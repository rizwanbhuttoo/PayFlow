import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getStatus,
  openDashboard,
  refreshStatus,
  startOnboarding,
} from "../controllers/stripe.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/status", asyncHandler(getStatus));
router.post("/onboarding", asyncHandler(startOnboarding));
router.post("/refresh", asyncHandler(refreshStatus));
router.post("/dashboard", asyncHandler(openDashboard));
export default router;
