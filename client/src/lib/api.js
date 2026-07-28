const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const tokenStore = {
  get: () => localStorage.getItem("payflow_token"),
  set: (token) => localStorage.setItem("payflow_token", token),
  clear: () => localStorage.removeItem("payflow_token"),
};

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const api = async (path, options = {}) => {
  const token = tokenStore.get();
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) tokenStore.clear();
    throw new ApiError(
      payload.error?.message || "The request could not be completed",
      response.status,
      payload.error?.code,
      payload.error?.details
    );
  }
  return payload.data ?? payload;
};

export const jsonOptions = (method, body) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const newIdempotencyKey = () => crypto.randomUUID();

export const idempotentJsonOptions = (method, body, idempotencyKey) => ({
  ...jsonOptions(method, body),
  headers: { "Idempotency-Key": idempotencyKey },
});
