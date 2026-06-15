import { NextRequest, NextResponse } from "next/server";
import { recordDisbursement, listDisbursements } from "./store";

/**
 * Mock disbursement provider endpoint (the "bank" / payment rail).
 *
 * In the real flow the TEE resolves the citizen's PII (full name) via
 * `http-with-placeholders` BEFORE this endpoint is called. So the body that
 * arrives HERE contains the resolved PII — proving it left the enclave only
 * toward the authorised provider, never toward the agent.
 *
 * The "money shot":
 *   - POST: this endpoint RECEIVES the resolved PII (recipient_name) and records it.
 *   - The agent/operator only ever sees the sanitised response (tx_id + status).
 *   - GET: returns the recorded ledger so the dashboard can SHOW the contrast.
 */

// PII must not be cached by any intermediary; always dynamic.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recipient_did,
      recipient_name,
      amount,
      currency,
      period,
      run_id,
      ...extra
    } = body ?? {};

    const txId = `TX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await recordDisbursement({
      received_at: new Date().toISOString(),
      tx_id: txId,
      recipient_did: recipient_did ?? "(missing)",
      // If the placeholder was NOT resolved, the literal "{{profile...}}" arrives —
      // surfacing that here makes a failed resolution obvious in the UI.
      recipient_name: recipient_name ?? "(name placeholder not resolved)",
      amount: Number(amount) || 0,
      currency: currency ?? "IDR",
      period: period ?? "",
      run_id: run_id ?? "",
      extra,
    });

    // Sanitised response — NO PII echoed back to the caller (the agent).
    return NextResponse.json(
      {
        // Canonical status the rest of the system checks for (matches the real
        // TEE contract's "SUCCESS"); keep it uppercase so success counts work.
        status: "SUCCESS",
        tx_id: txId,
        recipient_did: recipient_did ?? null,
        amount: Number(amount) || 0,
        currency: currency ?? "IDR",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("MOCK PROVIDER ERROR:", error);
    return NextResponse.json(
      { status: "error", message: "Mock provider internal error", tx_id: "" },
      { status: 500 },
    );
  }
}

/** Dashboard/audit viewer reads the received-payload ledger from here. */
export async function GET() {
  return NextResponse.json({ disbursements: await listDisbursements() }, { status: 200 });
}
