import { NextRequest, NextResponse } from "next/server";
import { operatorContext } from "@/lib/t3n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { period } = await req.json();
    const op = await operatorContext();
    const result = await op.t3n.executeAndDecode({
      script_name: op.scriptName,
      script_version: op.scriptVersion,
      function_name: "prepare-batch",
      input: {
        period: period ?? process.env.DISBURSE_PERIOD ?? "2026-07",
        policy: {
          eligible_regions: ["JKT", "BDG", "SBY", "SMG"],
          eligible_income_brackets: ["low", "medium"],
          total_budget: 50000000,
        },
      },
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
