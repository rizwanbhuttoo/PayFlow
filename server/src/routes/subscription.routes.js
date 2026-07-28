import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  cancellationSchema,
  idParamsSchema,
  linkTransactionsQuerySchema,
  subscriptionQuerySchema,
} from "../validation/schemas.js";
import {
  cancelSubscription,
  createCustomerPortal,
  getSubscription,
  getSubscriptionInvoices,
  listSubscriptions,
  removeScheduledCancellation,
} from "../controllers/subscription.controller.js";

const router = Router();
const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many subscription actions. Try again later.",
    },
  },
});

router.use(requireAuth);
router.get(
  "/",
  validate(subscriptionQuerySchema, "query"),
  asyncHandler(listSubscriptions)
);
router.use("/:id", validate(idParamsSchema, "params"));
router.get("/:id", asyncHandler(getSubscription));
router.get(
  "/:id/invoices",
  validate(linkTransactionsQuerySchema, "query"),
  asyncHandler(getSubscriptionInvoices)
);
router.post(
  "/:id/cancel",
  actionLimiter,
  validate(cancellationSchema),
  asyncHandler(cancelSubscription)
);
router.post(
  "/:id/resume",
  actionLimiter,
  asyncHandler(removeScheduledCancellation)
);
router.post(
  "/:id/portal",
  actionLimiter,
  asyncHandler(createCustomerPortal)
);

export default router;
