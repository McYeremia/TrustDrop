import { NextRequest, NextResponse } from "next/server";
import { operatorContext } from "@/lib/t3n/server";
import { isCreditError } from "@/lib/t3n/credit";
import { getApplication } from "@/app/api/_store/applications";
import { evaluateProgram, getProgram } from "@/lib/eligibility/programs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run the live TEE `check-eligibility` for a recipient. If the testnet account
 * is out of credit we fall back to the DETERMINISTIC system match (the same
 * issuer-fact evaluation the contract performs, which Fase 5 declares
 * authoritative for the demo) and label it `source:"system"` so it is never
 * mistaken for a live enclave verdict.
 */
export async function POST(req: NextRequest) {
  const { recipient_did, program_id } = await req.json();
  try {
    const op = await operatorContext();
    const result = await op.t3n.executeAndDecode({
      script_name: op.scriptName,
      script_version: op.scriptVersion,
      function_name: "check-eligibility",
      input: { recipient_did, program_id },
    });
    return NextResponse.json({ ok: true, source: "tee", result });
  } catch (e) {
    if (!isCreditError(e)) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : String(e) },
        { status: 200 },
      );
    }
    // Credit exhausted → deterministic fallback from the attested attributes.
    const app = program_id ? await getApplication(recipient_did, program_id) : null;
    const program = program_id ? getProgram(program_id) : null;
    if (!app || !program) {
      return NextResponse.json({
        ok: false,
        error: "TEE skipped (no testnet credit) and no local record to evaluate",
      });
    }
    const m = evaluateProgram(program, {
      region_code: app.region_code,
      income_bracket: app.income_bracket,
      household_status: app.household_status,
    });
    return NextResponse.json({
      ok: true,
      source: "system",
      tee_skipped: "no testnet credit",
      result: {
        recipient_did,
        program_id,
        eligible: m.eligible,
        reason_code: m.eligible ? "OK" : m.reason,
      },
    });
  }
}
