import test from "node:test";
import assert from "node:assert/strict";
import {
  hashRequest,
  requireIdempotencyKey,
} from "../src/services/idempotency.service.js";
import { customerManagementTokenSchema } from "../src/validation/schemas.js";

test("request hashing is stable across object key order and changes with payload", () => {
  assert.equal(
    hashRequest({ amount: 1000, currency: "usd" }),
    hashRequest({ currency: "usd", amount: 1000 })
  );
  assert.notEqual(
    hashRequest({ amount: 1000, currency: "usd" }),
    hashRequest({ amount: 2000, currency: "usd" })
  );
});

test("mutating Stripe operations require a bounded idempotency key", () => {
  assert.throws(
    () => requireIdempotencyKey({ get: () => undefined }),
    (error) => error.code === "IDEMPOTENCY_KEY_REQUIRED"
  );
  assert.equal(
    requireIdempotencyKey({ get: () => "operation-123" }),
    "operation-123"
  );
});

test("public management endpoint requires a high-entropy opaque token", () => {
  assert.throws(() => customerManagementTokenSchema.parse({ token: "short" }));
  assert.equal(
    customerManagementTokenSchema.parse({ token: "a".repeat(43) }).token.length,
    43
  );
});
