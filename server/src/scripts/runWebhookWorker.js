import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { startWebhookWorker } from "../workers/webhook.worker.js";

await connectDatabase();
const stop = startWebhookWorker();
const shutdown = async () => {
  stop();
  await mongoose.connection.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
