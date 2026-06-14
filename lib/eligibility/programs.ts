/**
 * Multi-program eligibility (Fase 5).
 *
 * The same issuer-signed facts (region/income/household) are evaluated against
 * MANY programs, each with its own criteria. Eligibility is therefore a relation
 * between a citizen and a specific program — not a property of the person. This
 * matching is DETERMINISTIC (system/contract job, never the AI).
 */
import programsData from "@/data/programs.json";
import { assignTier } from "./tiers";

export interface ProgramCriteria {
  regions: string[];
  income_brackets: string[];
  household_statuses?: string[];
}
export interface ProgramBenefit {
  mode: "tier" | "flat";
  flat_amount?: number;
}
export interface Program {
  program_id: string;
  name: string;
  institution: string;
  criteria: ProgramCriteria;
  benefit: ProgramBenefit;
  budget: number;
  period: string;
  dedup: boolean;
}

export const PROGRAMS = programsData as Program[];

export function getProgram(id: string): Program | null {
  return PROGRAMS.find((p) => p.program_id === id) ?? null;
}

export interface Attributes {
  region_code: string;
  income_bracket: string;
  household_status: string;
}

export type IneligibleReason =
  | "REGION_MISMATCH"
  | "INCOME_MISMATCH"
  | "HOUSEHOLD_MISMATCH";

export type ProgramMatch =
  | {
      program_id: string;
      name: string;
      institution: string;
      period: string;
      eligible: true;
      tier: string;
      amount: number;
    }
  | {
      program_id: string;
      name: string;
      institution: string;
      period: string;
      eligible: false;
      reason: IneligibleReason;
    };

/** Evaluate one program against a citizen's attested attributes. */
export function evaluateProgram(program: Program, attrs: Attributes): ProgramMatch {
  const base = {
    program_id: program.program_id,
    name: program.name,
    institution: program.institution,
    period: program.period,
  };

  if (!program.criteria.regions.includes(attrs.region_code)) {
    return { ...base, eligible: false, reason: "REGION_MISMATCH" };
  }
  if (!program.criteria.income_brackets.includes(attrs.income_bracket)) {
    return { ...base, eligible: false, reason: "INCOME_MISMATCH" };
  }
  const hh = program.criteria.household_statuses;
  if (hh && hh.length > 0 && !hh.includes(attrs.household_status)) {
    return { ...base, eligible: false, reason: "HOUSEHOLD_MISMATCH" };
  }

  // Eligible — compute the benefit.
  if (program.benefit.mode === "flat") {
    return { ...base, eligible: true, tier: "FLAT", amount: program.benefit.flat_amount ?? 0 };
  }
  const t = assignTier(attrs.income_bracket, attrs.household_status);
  if (!t) return { ...base, eligible: false, reason: "INCOME_MISMATCH" };
  return { ...base, eligible: true, tier: t.tier, amount: t.amount };
}

/** Evaluate a citizen against every program. */
export function matchPrograms(attrs: Attributes): ProgramMatch[] {
  return PROGRAMS.map((p) => evaluateProgram(p, attrs));
}
