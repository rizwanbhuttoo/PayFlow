import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  idParamsSchema,
  subscriptionInvoiceQuerySchema,
} from "../validation/schemas.js";
import {
  getSubscriptionInvoice,
  listSubscriptionInvoices,
} from "../controllers/subscriptionInvoice.controller.js";

const router = Router();
router.use(requireAuth);
router.get(
  "/",
  validate(subscriptionInvoiceQuerySchema, "query"),
  asyncHandler(listSubscriptionInvoices)
);
router.get(
  "/:id",
  validate(idParamsSchema, "params"),
  asyncHandler(getSubscriptionInvoice)
);

export default router;
