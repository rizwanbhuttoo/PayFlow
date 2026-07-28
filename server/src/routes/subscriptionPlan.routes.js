import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  idParamsSchema,
  subscriptionPlanCheckoutSchema,
  subscriptionPlanEmailSchema,
  subscriptionPlanQuerySchema,
  subscriptionPlanSchema,
} from "../validation/schemas.js";
import {
  createSubscriptionPlan,
  createSubscriptionPlanCheckout,
  deactivateSubscriptionPlan,
  emailSubscriptionPlan,
  getSubscriptionPlan,
  listSubscriptionPlans,
} from "../controllers/subscriptionPlan.controller.js";

const router = Router();
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Email limit reached. Try again later.",
    },
  },
});

router.use(requireAuth);
router
  .route("/")
  .get(
    validate(subscriptionPlanQuerySchema, "query"),
    asyncHandler(listSubscriptionPlans)
  )
  .post(validate(subscriptionPlanSchema), asyncHandler(createSubscriptionPlan));
router.use("/:id", validate(idParamsSchema, "params"));
router.get("/:id", asyncHandler(getSubscriptionPlan));
router.patch("/:id/deactivate", asyncHandler(deactivateSubscriptionPlan));
router.post(
  "/:id/checkout",
  validate(subscriptionPlanCheckoutSchema),
  asyncHandler(createSubscriptionPlanCheckout)
);
router.post(
  "/:id/email",
  emailLimiter,
  validate(subscriptionPlanEmailSchema),
  asyncHandler(emailSubscriptionPlan)
);

export default router;
