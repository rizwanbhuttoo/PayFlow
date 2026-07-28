import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  customerQuerySchema,
  customerCreateSchema,
  idParamsSchema,
  linkTransactionsQuerySchema,
} from "../validation/schemas.js";
import {
  getCustomer,
  getCustomerActivity,
  getCustomerInvoices,
  getCustomerSubscriptions,
  getCustomerTransactions,
  listCustomers,
  createCustomer,
} from "../controllers/customer.controller.js";

const router = Router();
router.use(requireAuth);
router
  .route("/")
  .get(validate(customerQuerySchema, "query"), asyncHandler(listCustomers))
  .post(validate(customerCreateSchema), asyncHandler(createCustomer));
router.use("/:id", validate(idParamsSchema, "params"));
router.get("/:id", asyncHandler(getCustomer));
router.get("/:id/activity", asyncHandler(getCustomerActivity));
router.get(
  "/:id/transactions",
  validate(linkTransactionsQuerySchema, "query"),
  asyncHandler(getCustomerTransactions)
);
router.get(
  "/:id/subscriptions",
  validate(linkTransactionsQuerySchema, "query"),
  asyncHandler(getCustomerSubscriptions)
);
router.get(
  "/:id/invoices",
  validate(linkTransactionsQuerySchema, "query"),
  asyncHandler(getCustomerInvoices)
);

export default router;
