import { NextResponse } from "next/server";
import { grantAgentAuth, previewGrant } from "@/lib/t3n/agent-auth";
import { getAuthState, setAuthState } from "@/lib/agent/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → current delegation state (or a read-only preview of the scope).
export async function GET() {
  try {
    const stored = await getAuthState();
    if (stored) return NextResponse.json({ ok: true, ...stored });

    const preview = await previewGrant();
    return NextResponse.json({ ok: true, authorized: false, ...preview, grantedAt: "" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}

// POST → operator signs the agent-auth-update grant (real testnet call).
export async function POST() {
  try {
    const grant = await grantAgentAuth();
    const state = {
      authorized: true,
      agentDid: grant.agentDid,
      operatorDid: grant.operatorDid,
      scriptName: grant.scriptName,
      functions: grant.functions,
      allowedHosts: grant.allowedHosts,
      grantedAt: new Date().toISOString(),
    };
    await setAuthState(state);
    return NextResponse.json({ ok: true, ...state, selfGrant: grant.selfGrant });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
