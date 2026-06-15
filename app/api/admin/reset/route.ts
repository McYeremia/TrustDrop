import { NextResponse } from "next/server";
import { clearApplications } from "@/app/api/_store/applications";
import { clearDisbursements } from "@/app/api/mock-provider/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo reset: wipe the local application queue + provider ledger. Does not
 *  touch the on-chain contract (that needs re-provision). */
export async function POST() {
  await Promise.all([clearApplications(), clearDisbursements()]);
  return NextResponse.json({ ok: true });
}
