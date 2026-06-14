import { describe, it, expect } from "vitest";
import { assignTier, previewEligibility } from "./tiers";

describe("assignTier", () => {
  it("G1 for low + vulnerable", () => {
    expect(assignTier("low", "elderly")).toEqual({ tier: "G1", amount: 700000 });
    expect(assignTier("low", "disabled")).toEqual({ tier: "G1", amount: 700000 });
    expect(assignTier("low", "single_parent")).toEqual({ tier: "G1", amount: 700000 });
  });
  it("G2 for low + non-vulnerable", () => {
    expect(assignTier("low", "head_of_family")).toEqual({ tier: "G2", amount: 600000 });
    expect(assignTier("low", "married")).toEqual({ tier: "G2", amount: 600000 });
  });
  it("G3 for medium", () => {
    expect(assignTier("medium", "married")).toEqual({ tier: "G3", amount: 400000 });
  });
  it("null for high income", () => {
    expect(assignTier("high", "elderly")).toBeNull();
  });
});

describe("previewEligibility", () => {
  it("rejects out-of-region", () => {
    expect(previewEligibility("MDN", "low", "elderly")).toEqual({
      eligible: false,
      reason: "REGION_MISMATCH",
    });
  });
  it("rejects high income", () => {
    expect(previewEligibility("JKT", "high", "married")).toEqual({
      eligible: false,
      reason: "INCOME_MISMATCH",
    });
  });
  it("accepts eligible recipient with tier", () => {
    expect(previewEligibility("JKT", "low", "elderly")).toEqual({
      eligible: true,
      tier: "G1",
      amount: 700000,
    });
  });
});
