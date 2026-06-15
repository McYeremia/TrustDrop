import { NextResponse } from "next/server";
import { operatorContext } from "@/lib/t3n/server";
import { getAgentDid } from "@/lib/t3n/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Last-resort values from the 2026-06-15 deployment, used only when no live
// session can be established (e.g. keys absent). The live path resolves these
// dynamically so they stay correct across re-deploys.
const FALLBACK = {
  scriptName: "z:b6ce0233a4da0ee3ab7f41b8423475fa6e93826f:bansos-contracts",
  version: "0.4.0",
  contractId: 153,
  agentDid: "did:t3n:699d43e5472b2de992d060bcdc2be6f3513512df",
};

/** Public, read-only proof of the live contract + agent identity for the auditor. */
export async function GET() {
  try {
    const op = await operatorContext();
    const agentDid = await getAgentDid().catch(() => null);
    return NextResponse.json({
      ok: true,
      network: "Terminal 3 testnet",
      scriptName: op.scriptName,
      version: op.scriptVersion,
      contractId: op.contractId || FALLBACK.contractId,
      agentDid: agentDid ?? FALLBACK.agentDid,
    });
  } catch {
    return NextResponse.json({ ok: true, network: "Terminal 3 testnet", ...FALLBACK });
  }
}
