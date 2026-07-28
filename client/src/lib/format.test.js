import { describe, expect, it } from "vitest";
import { formatBillingInterval, formatMoney, humanize } from "./format";

describe("format helpers", () => {
  it("formats amounts stored in minor currency units", () => {
    expect(formatMoney(12550, "usd")).toContain("125.50");
  });

  it("humanizes API status values", () => {
    expect(humanize("partially_refunded")).toBe("Partially Refunded");
  });

  it("formats supported recurring billing intervals", () => {
    expect(formatBillingInterval("monthly")).toBe("Monthly");
    expect(formatBillingInterval("yearly")).toBe("Yearly");
  });
});
