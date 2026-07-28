import mongoose from "mongoose";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logError } from "./utils/logger.js";
import { startWebhookWorker } from "./workers/webhook.worker.js";
import { startEmailWorker } from "./workers/email.worker.js";
import { startPaymentLinkExpiryWorker } from "./workers/paymentLinkExpiry.worker.js";
import { startReconciliationWorker } from "./workers/reconciliation.worker.js";

let server;
let stopWorkers = [];
let shuttingDown = false;

const start = async () => {
  await connectDatabase();
  stopWorkers = [
    startWebhookWorker(),
    startEmailWorker(),
    startPaymentLinkExpiryWorker(),
    startReconciliationWorker(),
  ];
  server = app.listen(env.port, () => {
    console.log(`PayFlow API listening on http://localhost:${env.port}`);
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing cleanly`);
  stopWorkers.forEach((stop) => stop());
  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
  clearTimeout(forceExit);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logError("Unhandled rejection", error);
  void shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
  void shutdown("uncaughtException");
});

start().catch((error) => {
  logError("Server failed to start", error);
  process.exit(1);
});
