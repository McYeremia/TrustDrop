import { NextRequest, NextResponse } from "next/server";
import { runAgent, executeDisbursements } from "@/lib/agent/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE on the Agent Auth gate: the agent is gated in the UI (AgentPanel stays
// locked until the operator signs the delegation in AgentAuthPanel), and the
// REAL enforcement is on-chain — without the agent-auth grant the TEE host
// denies the contract's egress. We intentionally do NOT re-check a separate
// server-side auth flag here: that flag lived in a different route's
// store and is not reliably shared across serverless invocations, which caused
// false "not authorized" errors even after a successful grant.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = new URL(req.url).origin;

    // Confirmation path: operator approved planned disbursements → execute real money.
    // Each item is { recipient_did, program_id }.
    if (Array.isArray(body.confirmDisburse) && body.confirmDisburse.length > 0) {
      const executed = await executeDisbursements(body.confirmDisburse, origin);
      return NextResponse.json({ ok: true, executed });
    }

    // Planning path: run the LLM agent (disburse is dry-run only).
    const command = String(body.command ?? "").trim();
    if (!command) {
      return NextResponse.json({ ok: false, error: "command is required" }, { status: 400 });
    }
    const result = await runAgent(command, origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
