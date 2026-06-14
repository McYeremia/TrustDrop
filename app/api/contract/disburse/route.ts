import { NextRequest, NextResponse } from "next/server";
import recipients from "@/data/recipients.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecipientProfile {
  recipient_did: string;
  legal_name: string;
}

/**
 * Hybrid demo disbursement. The operator only sends a `recipient_did` — never a
 * name. This route stands in for the enclave's placeholder resolution: it looks
 * up the citizen's name from their profile server-side and posts it to the mock
 * provider, so the operator's browser never holds PII. The genuine
 * enclave-resolved path remains `scripts/onboard-recipient.ts`.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const profile = (recipients as RecipientProfile[]).find(
    (r) => r.recipient_did === b.recipient_did,
  );
  const recipient_name = profile?.legal_name ?? "(name not resolved)";

  const origin = new URL(req.url).origin;
  const r = await fetch(`${origin}/api/mock-provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient_did: b.recipient_did,
      recipient_name,
      amount: b.amount,
      currency: "IDR",
      period: b.period ?? process.env.DISBURSE_PERIOD ?? "2026-07",
      run_id: `run-${Date.now()}`,
      tier: b.tier,
      program_id: b.program_id,
    }),
  });
  const provider = await r.json();
  // Return only the sanitised result to the caller (no name echoed back).
  return NextResponse.json({ ok: true, tx_id: provider.tx_id, status: provider.status });
}
