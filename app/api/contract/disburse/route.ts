import { NextRequest, NextResponse } from "next/server";
import recipients from "@/data/recipients.json";
import { getApplication, upsertApplication } from "@/app/api/_store/applications";

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

  // Idempotency: an approved application is paid at most once. Re-clicking
  // Disburse returns the existing receipt instead of paying the provider again.
  const existing = b.program_id
    ? await getApplication(b.recipient_did, b.program_id)
    : null;
  if (existing?.disbursed_at) {
    return NextResponse.json({
      ok: true,
      status: "ALREADY_DISBURSED",
      tx_id: existing.tx_id,
      disbursed_at: existing.disbursed_at,
    });
  }

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

  // Mark the application paid so the UI can show it and we don't double-pay.
  if (existing) {
    await upsertApplication({
      ...existing,
      disbursed_at: new Date().toISOString(),
      tx_id: provider.tx_id,
    });
  }

  // Return only the sanitised result to the caller (no name echoed back).
  return NextResponse.json({ ok: true, tx_id: provider.tx_id, status: provider.status });
}
