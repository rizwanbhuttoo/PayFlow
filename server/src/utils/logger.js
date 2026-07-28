import { isProduction } from "../config/env.js";

export const logError = (context, error) => {
  const entry = {
    level: "error",
    timestamp: new Date().toISOString(),
    operation: context,
    error: {
      name: error?.name || "Error",
      code: error?.code,
      message: error?.message || "Unknown error",
    },
  };
  console.error(isProduction ? JSON.stringify(entry) : entry);
};

export const logInfo = (operation, details = {}) => {
  const entry = {
    level: "info",
    timestamp: new Date().toISOString(),
    operation,
    ...details,
  };
  console.info(isProduction ? JSON.stringify(entry) : entry);
};
