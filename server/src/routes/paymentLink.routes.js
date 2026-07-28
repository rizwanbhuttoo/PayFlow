import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  idParamsSchema,
  linkTransactionsQuerySchema,
  paymentEmailSchema,
  paymentLinkQuerySchema,
  paymentLinkSchema,
} from "../validation/schemas.js";
import {
  createPaymentLink,
  deactivatePaymentLink,
  emailPaymentLink,
  getLinkTransactions,
  getPaymentLink,
  listPaymentLinks,
} from "../controllers/paymentLink.controller.js";

const router = Router();
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Email limit reached. Try again later." } },
});
router.use(requireAuth);
router
  .route("/")
  .get(validate(paymentLinkQuerySchema, "query"), asyncHandler(listPaymentLinks))
  .post(validate(paymentLinkSchema), asyncHandler(createPaymentLink));
router.use("/:id", validate(idParamsSchema, "params"));
router.get("/:id", asyncHandler(getPaymentLink));
router.patch("/:id/deactivate", asyncHandler(deactivatePaymentLink));
router.post("/:id/email", emailLimiter, validate(paymentEmailSchema), asyncHandler(emailPaymentLink));
router.get(
  "/:id/transactions",
  validate(linkTransactionsQuerySchema, "query"),
  asyncHandler(getLinkTransactions)
);
export default router;
