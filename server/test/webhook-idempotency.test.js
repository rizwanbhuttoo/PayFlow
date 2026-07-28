import test from "node:test";
import assert from "node:assert/strict";
import {
  getRefundStatus,
  isWebhookRetryEligible,
  shouldApplyTransactionStatus,
} from "../src/services/webhook.service.js";

test("one-time payment status transitions remain monotonic", () => {
  assert.equal(shouldApplyTransactionStatus("pending", "succeeded"), true);
  assert.equal(shouldApplyTransactionStatus("failed", "succeeded"), true);
  assert.equal(shouldApplyTransactionStatus("succeeded", "failed"), false);
});

test("webhook retries remain bounded and processed events are not claimed again", () => {
  assert.equal(
    isWebhookRetryEligible({ status: "received", attempts: 0 }),
    true
  );
  assert.equal(
    isWebhookRetryEligible({ status: "failed", attempts: 4 }),
    true
  );
  assert.equal(
    isWebhookRetryEligible({ status: "deferred", attempts: 2 }),
    true
  );
  assert.equal(
    isWebhookRetryEligible({ status: "failed", attempts: 5 }),
    false
  );
  assert.equal(
    isWebhookRetryEligible({ status: "processed", attempts: 1 }),
    false
  );
  assert.equal(
    isWebhookRetryEligible({ status: "ignored", attempts: 1 }),
    false
  );
  assert.equal(
    isWebhookRetryEligible({ status: "dead_letter", attempts: 5 }),
    false
  );
});

test("refund status still distinguishes partial and full refunds", () => {
  assert.equal(getRefundStatus(1000, 500), "partially_refunded");
  assert.equal(getRefundStatus(1000, 1000), "refunded");
});
