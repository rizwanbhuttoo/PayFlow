import { Router, raw } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { receiveStripeWebhook } from "../controllers/webhook.controller.js";

const router = Router();
router.post("/stripe", raw({ type: "application/json", limit: "1mb" }), asyncHandler(receiveStripeWebhook));
export default router;
