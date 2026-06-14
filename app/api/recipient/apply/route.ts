import { NextRequest, NextResponse } from "next/server";
import { verifyAttestation, type Attestation } from "@/lib/issuer/issuer";
import { previewEligibility } from "@/lib/eligibility/tiers";
import { upsertApplication } from "@/app/api/_store/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const recipient_did: string = body.recipient_did;
  const attestations: Attestation[] = body.attestations ?? [];
  const attrs = body.attributes ?? {};

  if (!recipient_did) {
    return NextResponse.json({ ok: false, reason: "MISSING_DID" }, { status: 400 });
  }

  const allValid = (await Promise.all(attestations.map(verifyAttestation))).every(Boolean);
  if (!allValid) {
    return NextResponse.json({ ok: false, reason: "INVALID_SIGNATURE" }, { status: 400 });
  }

  const preview = previewEligibility(attrs.region_code, attrs.income_bracket, attrs.household_status);
  if (!preview.eligible) {
    return NextResponse.json({ ok: false, reason: preview.reason, preview });
  }

  await upsertApplication({
    recipient_did,
    region_code: attrs.region_code,
    income_bracket: attrs.income_bracket,
    household_status: attrs.household_status,
    tier: preview.tier,
    amount: preview.amount,
    issuers: attestations.map((a) => a.issuer),
    status: "pending",
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, status: "pending", preview });
}
