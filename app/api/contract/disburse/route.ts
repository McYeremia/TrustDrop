import { NextRequest, NextResponse } from "next/server";
import recipients from "@/data/recipients.json";
import demoRecipients from "@/data/demo-recipients.json";
import { getApplication, upsertApplication } from "@/app/api/_store/applications";
import { operatorContext, ensureDedupMap } from "@/lib/t3n/server";
import { disburseAsAgent } from "@/lib/t3n/agent-client";
import { isCreditError } from "@/lib/t3n/credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecipientProfile {
  recipient_did: string;
  legal_name: string;
}

// Recipients with a real T3N identity + grant the agent can act for. Only these
// can take the live agent→TEE path; everyone else uses the hybrid demo path.
const DEMO_DIDS = new Set(
  (demoRecipients as { recipient_did: string }[]).map((r) => r.recipient_did),
);

function period(b: { period?: string }): string {
  return b.period ?? process.env.DISBURSE_PERIOD ?? "2026-07";
}

/**
 * Disbursement. Two paths, same sanitised contract (returns tx_id + status, no PII):
 *
 *  - LIVE (source:"tee"): for onboarded demo recipients, the AGENT (its own DID)
 *    invokes execute-disbursement on the live contract with pii_did=recipient.
 *    The enclave resolves the name and pays the provider; the agent never sees it.
 *  - HYBRID (source:"system"): fallback for recipients without a T3N identity, or
 *    when the testnet account is out of credit / the live call errors. Resolves
 *    the name server-side and posts to the mock provider so the browser holds no PII.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();

  // Idempotency: an approved application is paid at most once.
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

  // ── LIVE: agent → TEE (only for onboarded demo recipients) ──
  if (DEMO_DIDS.has(b.recipient_did) && process.env.AGENT_KEY) {
    try {
      const live = await disburseLive(b.recipient_did, b.program_id, period(b));
      if (live.success) {
        if (existing) {
          await upsertApplication({
            ...existing,
            disbursed_at: new Date().toISOString(),
            tx_id: live.tx_id,
            disbursed_source: "tee",
            contract_id: live.contract_id,
          });
        }
        return NextResponse.json({
          ok: true,
          source: "tee",
          status: live.status,
          tx_id: live.tx_id,
          agent_did: live.agent_did,
          script_name: live.script_name,
          contract_id: live.contract_id,
        });
      }
      // Contract ran but declined (e.g. SKIPPED_DUPLICATE / INELIGIBLE) — report it
      // verbatim; do NOT silently fall back to hybrid (would mask a real verdict).
      return NextResponse.json({
        ok: false,
        source: "tee",
        status: live.status,
        tx_id: live.tx_id,
        contract_id: live.contract_id,
      });
    } catch (e) {
      if (!isCreditError(e)) {
        // Unexpected live error → fall through to hybrid, but surface why.
        console.error("live disburse error:", e);
      }
      // credit exhausted or live error → hybrid fallback below
    }
  }

  // ── HYBRID: server-side name resolution → mock provider ──
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
      period: period(b),
      run_id: `run-${Date.now()}`,
      tier: b.tier,
      program_id: b.program_id,
    }),
  });
  const provider = await r.json();

  if (existing) {
    await upsertApplication({
      ...existing,
      disbursed_at: new Date().toISOString(),
      tx_id: provider.tx_id,
      disbursed_source: "system",
    });
  }

  return NextResponse.json({
    ok: true,
    source: "system",
    tx_id: provider.tx_id,
    status: provider.status,
  });
}

/** Run the live agent→TEE disbursement, creating the period's dedup ledger first. */
async function disburseLive(recipient_did: string, program_id: string, per: string) {
  const op = await operatorContext();
  await ensureDedupMap(program_id, per);
  const res = await disburseAsAgent({
    recipient_did,
    program_id,
    period: per,
    provider_url: process.env.MOCK_PROVIDER_URL ?? "https://httpbin.org/anything",
    scriptName: op.scriptName,
    scriptVersion: op.scriptVersion,
  });
  return { ...res, script_name: op.scriptName, contract_id: op.contractId };
}
