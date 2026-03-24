import { describe, it, expect } from "vitest";
import { normalizeMerchant } from "@/lib/merchant-utils";

describe("normalizeMerchant", () => {
  it("title-cases ALL CAPS merchant names", () => {
    expect(normalizeMerchant("FOODPANDA BANGLADESH")).toBe("Foodpanda Bangladesh");
  });

  it("preserves known acronyms", () => {
    expect(normalizeMerchant("KFC GULSHAN 412 DHAKA BD")).toBe("KFC Gulshan 412 Dhaka BD");
    expect(normalizeMerchant("DHL EXPRESS BD")).toBe("DHL Express BD");
    expect(normalizeMerchant("ONE MANAGEMENT LTD GULSHAN")).toBe("One Management LTD Gulshan");
  });

  it("strips HTML entities", () => {
    expect(normalizeMerchant("BRAC BANK LTD.&nbsp;")).toBe("Brac Bank Ltd.");
    expect(normalizeMerchant("TEST&amp;MERCHANT")).toBe("Test&merchant");
  });

  it("collapses whitespace", () => {
    expect(normalizeMerchant("  MULTIPLE   SPACES   ")).toBe("Multiple Spaces");
  });

  it("handles empty and null-like input", () => {
    expect(normalizeMerchant("")).toBe("");
    expect(normalizeMerchant("   ")).toBe("");
  });

  it("handles numeric entities", () => {
    expect(normalizeMerchant("TEST&#32;MERCHANT")).toBe("Test Merchant");
  });
});
