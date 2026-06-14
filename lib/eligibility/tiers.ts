export const ELIGIBLE_REGIONS = ["JKT", "BDG", "SBY", "SMG"] as const;
export const ELIGIBLE_INCOME = ["low", "medium"] as const;

export interface TierResult {
  tier: "G1" | "G2" | "G3";
  amount: number;
}

const VULNERABLE = new Set(["elderly", "disabled", "single_parent"]);

/** Mirror of the contract's assign_tier rule (spec §4). */
export function assignTier(income: string, household: string): TierResult | null {
  if (income === "low") {
    return VULNERABLE.has(household)
      ? { tier: "G1", amount: 700000 }
      : { tier: "G2", amount: 600000 };
  }
  if (income === "medium") return { tier: "G3", amount: 400000 };
  return null;
}

export type PreviewResult =
  | { eligible: true; tier: "G1" | "G2" | "G3"; amount: number }
  | { eligible: false; reason: "REGION_MISMATCH" | "INCOME_MISMATCH" };

/** Full eligibility preview against policy (region + income + tier). */
export function previewEligibility(
  region: string,
  income: string,
  household: string,
): PreviewResult {
  if (!ELIGIBLE_REGIONS.includes(region as (typeof ELIGIBLE_REGIONS)[number])) {
    return { eligible: false, reason: "REGION_MISMATCH" };
  }
  const t = assignTier(income, household);
  if (!t) return { eligible: false, reason: "INCOME_MISMATCH" };
  return { eligible: true, ...t };
}
