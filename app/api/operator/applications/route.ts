import { NextResponse } from "next/server";
import { listApplications } from "@/app/api/_store/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ applications: await listApplications() });
}
