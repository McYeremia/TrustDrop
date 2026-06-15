import { NextResponse } from "next/server";
import demoRecipients from "@/data/demo-recipients.json";
import { upsertApplication, type Application } from "@/app/api/_store/applications";
import { evaluateProgram, getProgram } from "@/lib/eligibility/programs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DemoRecipient {
  label: string;
  recipient_did: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  program_id: string;
}

/**
 * Seed the onboarded demo recipients (r1/r2) as APPROVED applications so the
 * operator console can drive a live agent→TEE disbursement through the UI. Their
 * T3N identity, PII profile, eligibility record and agent grant already exist on
 * testnet (via scripts/agent-money-shot.ts) — this only mirrors them into the
 * local application store. No PII is stored (names live only in the T3N profile).
 */
export async function POST() {
  const seeded: string[] = [];
  for (const r of demoRecipients as DemoRecipient[]) {
    const program = getProgram(r.program_id);
    if (!program) continue;
    const m = evaluateProgram(program, {
      region_code: r.region_code,
      income_bracket: r.income_bracket,
      household_status: r.household_status,
    });
    const app: Application = {
      recipient_did: r.recipient_did,
      program_id: program.program_id,
      program_name: program.name,
      region_code: r.region_code,
      income_bracket: r.income_bracket,
      household_status: r.household_status,
      tier: m.eligible ? m.tier : "",
      amount: m.eligible ? m.amount : 0,
      eligible: m.eligible,
      reason: m.eligible ? undefined : m.reason,
      issuers: ["Tax Office", "Civil Registry"],
      status: "approved",
      decided_by: "demo-seed",
      decided_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    await upsertApplication(app);
    seeded.push(`${r.label}:${r.program_id}`);
  }
  return NextResponse.json({ ok: true, seeded });
}
