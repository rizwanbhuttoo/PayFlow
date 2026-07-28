import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema, transactionQuerySchema } from "../validation/schemas.js";
import { getTransaction, listTransactions } from "../controllers/transaction.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", validate(transactionQuerySchema, "query"), asyncHandler(listTransactions));
router.get("/:id", validate(idParamsSchema, "params"), asyncHandler(getTransaction));
export default router;
