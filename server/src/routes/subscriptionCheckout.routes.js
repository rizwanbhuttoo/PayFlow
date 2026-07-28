import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  customerManagementTokenSchema,
  publicCheckoutParamsSchema,
} from "../validation/schemas.js";
import {
  createPublicCustomerPortal,
  getManagementSummary,
  getSubscriptionCheckoutSummary,
} from "../controllers/subscriptionCheckout.controller.js";

const router = Router();
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many portal requests. Try again later.",
    },
  },
});

router.use(
  "/:planId/sessions/:sessionId",
  validate(publicCheckoutParamsSchema, "params")
);
router.get(
  "/:planId/sessions/:sessionId",
  asyncHandler(getSubscriptionCheckoutSummary)
);
router.post(
  "/manage/summary",
  portalLimiter,
  validate(customerManagementTokenSchema),
  asyncHandler(getManagementSummary)
);
router.post(
  "/manage/portal",
  portalLimiter,
  validate(customerManagementTokenSchema),
  asyncHandler(createPublicCustomerPortal)
);

export default router;
