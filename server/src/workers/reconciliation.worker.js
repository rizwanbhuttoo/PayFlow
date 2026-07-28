import { reconcileAll } from "../services/reconciliation.service.js";
import { logError, logInfo } from "../utils/logger.js";

export const startReconciliationWorker = ({
  intervalMs = 6 * 60 * 60 * 1000,
} = {}) => {
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const result = await reconcileAll();
      logInfo("reconciliation_completed", { result });
    } catch (error) {
      logError("Reconciliation failed", error);
    }
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
};
