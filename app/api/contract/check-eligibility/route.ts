import { NextRequest, NextResponse } from "next/server";
import { operatorContext } from "@/lib/t3n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { recipient_did } = await req.json();
    const op = await operatorContext();
    const result = await op.t3n.executeAndDecode({
      script_name: op.scriptName,
      script_version: op.scriptVersion,
      function_name: "check-eligibility",
      input: { recipient_did },
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
