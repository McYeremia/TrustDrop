import { NextRequest, NextResponse } from "next/server";
import { verifyAttestation, type Attestation } from "@/lib/issuer/issuer";
import { evaluateProgram, getProgram } from "@/lib/eligibility/programs";
import { upsertApplication, getApplication } from "@/app/api/_store/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const recipient_did: string = body.recipient_did;
  const attestations: Attestation[] = body.attestations ?? [];
  const attrs = body.attributes ?? {};
  const programIds: string[] = body.program_ids ?? [];

  if (!recipient_did) {
    return NextResponse.json({ ok: false, reason: "MISSING_DID" }, { status: 400 });
  }
  if (!Array.isArray(programIds) || programIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_PROGRAM_SELECTED" }, { status: 400 });
  }

  const allValid = (await Promise.all(attestations.map(verifyAttestation))).every(Boolean);
  if (!allValid) {
    return NextResponse.json({ ok: false, reason: "INVALID_SIGNATURE" }, { status: 400 });
  }

  // One application per program per recipient. Eligibility is re-evaluated
  // server-side (authoritative) per program — the citizen cannot fake the
  // verdict. A recipient may apply only once: if an application for this
  // did+program already exists we DO NOT overwrite it (that would reset an
  // approved/disbursed row back to pending and allow double-disbursement).
  const created: { program_id: string; eligible: boolean }[] = [];
  const skipped: { program_id: string; status: string }[] = [];
  for (const pid of programIds) {
    const program = getProgram(pid);
    if (!program) continue;

    const existing = await getApplication(recipient_did, pid);
    if (existing) {
      skipped.push({ program_id: program.program_id, status: existing.status });
      continue;
    }

    const match = evaluateProgram(program, attrs);
    await upsertApplication({
      recipient_did,
      program_id: program.program_id,
      program_name: program.name,
      region_code: attrs.region_code,
      income_bracket: attrs.income_bracket,
      household_status: attrs.household_status,
      tier: match.eligible ? match.tier : "",
      amount: match.eligible ? match.amount : 0,
      eligible: match.eligible,
      reason: match.eligible ? undefined : match.reason,
      issuers: attestations.map((a) => a.issuer),
      status: "pending",
      created_at: new Date().toISOString(),
    });
    created.push({ program_id: program.program_id, eligible: match.eligible });
  }

  return NextResponse.json({
    ok: true,
    count: created.length,
    created,
    skipped,
    // A clear flag the UI can use when nothing new was created.
    already_applied: created.length === 0 && skipped.length > 0,
  });
}
