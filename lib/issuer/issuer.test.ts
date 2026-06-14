import { describe, it, expect } from "vitest";
import { issueAttestation, verifyAttestation } from "./issuer";

describe("issuer attestation", () => {
  it("signs a claim that verifies", async () => {
    const att = await issueAttestation("tax", { income_bracket: "low" });
    expect(att.issuer).toBe("tax");
    expect(await verifyAttestation(att)).toBe(true);
  });
  it("rejects a tampered claim", async () => {
    const att = await issueAttestation("tax", { income_bracket: "low" });
    att.claims.income_bracket = "high";
    expect(await verifyAttestation(att)).toBe(false);
  });
});
