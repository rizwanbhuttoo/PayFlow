import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, getSafeExternalUrl, shareContent } from "./browser";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser capability helpers", () => {
  it("allows HTTPS external links and rejects unsafe protocols", () => {
    expect(getSafeExternalUrl("https://checkout.stripe.com/test")).toBe(
      "https://checkout.stripe.com/test"
    );
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("http://example.com")).toBeNull();
  });

  it("reports unavailable clipboard access without throwing", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("value")).resolves.toBe(false);
  });

  it("distinguishes a cancelled native share", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(
        Object.assign(new Error("cancelled"), { name: "AbortError" })
      ),
    });
    await expect(shareContent({ title: "Test" })).resolves.toBe("cancelled");
  });
});
