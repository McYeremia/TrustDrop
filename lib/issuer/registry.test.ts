import { describe, it, expect } from "vitest";
import { lookupCitizen, attestCitizen } from "./registry";
import { verifyAttestation } from "./issuer";

describe("registry", () => {
  it("finds an existing citizen", () => {
    expect(lookupCitizen("3201010101010006")?.income_bracket).toBe("low");
  });
  it("returns null for unknown nik", () => {
    expect(lookupCitizen("0000000000000000")).toBeNull();
  });
  it("attests TRUE value (rich person stays high)", async () => {
    const bundle = await attestCitizen("9999000000000001");
    expect(bundle).not.toBeNull();
    expect(bundle!.attributes.income_bracket).toBe("high");
    const tax = bundle!.attestations.find((a) => a.issuer === "tax")!;
    expect(await verifyAttestation(tax)).toBe(true);
  });
});
