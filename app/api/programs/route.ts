import { NextResponse } from "next/server";
import { PROGRAMS } from "@/lib/eligibility/programs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ programs: PROGRAMS });
}
