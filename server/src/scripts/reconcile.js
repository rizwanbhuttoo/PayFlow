import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { reconcileAll } from "../services/reconciliation.service.js";

try {
  await connectDatabase();
  const result = await reconcileAll();
  console.info(JSON.stringify(result, null, 2));
  if (result.subscriptionErrors) process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
