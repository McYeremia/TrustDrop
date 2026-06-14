import { NextRequest, NextResponse } from "next/server";
import { runAgent, executeDisbursements } from "@/lib/agent/agent";
import { getAuthState } from "@/lib/agent/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = new URL(req.url).origin;

    // The agent may act only under an active delegation (Agent Auth grant).
    const auth = await getAuthState();
    if (!auth?.authorized) {
      return NextResponse.json(
        { ok: false, error: "Agent is not authorized. Sign the Agent Auth delegation first." },
        { status: 200 },
      );
    }

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
