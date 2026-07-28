import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getDashboard,
  getDashboardAlerts,
  getDashboardRecent,
  getDashboardSummary,
} from "../controllers/dashboard.controller.js";

const router = Router();
router.get("/", requireAuth, asyncHandler(getDashboard));
router.get("/summary", requireAuth, asyncHandler(getDashboardSummary));
router.get("/recent", requireAuth, asyncHandler(getDashboardRecent));
router.get("/alerts", requireAuth, asyncHandler(getDashboardAlerts));
export default router;
