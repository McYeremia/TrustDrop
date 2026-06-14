import { describe, it, expect } from "vitest";
import { matchPrograms, getProgram, evaluateProgram } from "./programs";

describe("matchPrograms", () => {
  it("elderly low-income Jakarta qualifies for cash + national elderly", () => {
    const m = matchPrograms({ region_code: "JKT", income_bracket: "low", household_status: "elderly" });
    const jkt = m.find((p) => p.program_id === "jkt-cash-2026")!;
    const eld = m.find((p) => p.program_id === "elderly-national-2026")!;
    const bdg = m.find((p) => p.program_id === "bdg-food-2026")!;
    expect(jkt.eligible).toBe(true);
    expect(eld.eligible).toBe(true);
    expect(bdg.eligible).toBe(false); // wrong region
    if (jkt.eligible) expect(jkt).toMatchObject({ tier: "G1", amount: 700000 });
    if (eld.eligible) expect(eld).toMatchObject({ tier: "FLAT", amount: 300000 });
  });

  it("medium married Jakarta qualifies only for cash G3 (not elderly, not bandung)", () => {
    const m = matchPrograms({ region_code: "JKT", income_bracket: "medium", household_status: "married" });
    expect(m.find((p) => p.program_id === "jkt-cash-2026")!.eligible).toBe(true);
    const eld = m.find((p) => p.program_id === "elderly-national-2026")!;
    expect(eld.eligible).toBe(false);
    if (!eld.eligible) expect(eld.reason).toBe("HOUSEHOLD_MISMATCH");
  });

  it("Bandung low head_of_family qualifies only for Bandung food (flat 500k)", () => {
    const m = matchPrograms({ region_code: "BDG", income_bracket: "low", household_status: "head_of_family" });
    const bdg = m.find((p) => p.program_id === "bdg-food-2026")!;
    expect(bdg.eligible).toBe(true);
    if (bdg.eligible) expect(bdg.amount).toBe(500000);
    expect(m.find((p) => p.program_id === "jkt-cash-2026")!.eligible).toBe(false);
  });

  it("high income qualifies for nothing", () => {
    const m = matchPrograms({ region_code: "JKT", income_bracket: "high", household_status: "married" });
    expect(m.every((p) => !p.eligible)).toBe(true);
  });

  it("out-of-coverage region qualifies for nothing", () => {
    const m = matchPrograms({ region_code: "MDN", income_bracket: "low", household_status: "elderly" });
    expect(m.every((p) => !p.eligible)).toBe(true);
  });
});

describe("evaluateProgram", () => {
  it("flat program ignores tier rule", () => {
    const p = getProgram("bdg-food-2026")!;
    const r = evaluateProgram(p, { region_code: "BDG", income_bracket: "low", household_status: "married" });
    expect(r.eligible).toBe(true);
    if (r.eligible) expect(r).toMatchObject({ tier: "FLAT", amount: 500000 });
  });
});
