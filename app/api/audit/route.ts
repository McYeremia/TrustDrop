import { NextResponse } from "next/server";
import { listApplications } from "@/app/api/_store/applications";
import { listDisbursements } from "@/app/api/mock-provider/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [applications, disbursements] = await Promise.all([
    listApplications(),
    listDisbursements(),
  ]);
  return NextResponse.json({
    decisions: applications.map((a) => ({
      recipient_did: a.recipient_did,
      status: a.status,
      tier: a.tier,
      decided_by: a.decided_by,
      decided_at: a.decided_at,
      issuers: a.issuers,
    })),
    disbursements: disbursements.map((d) => ({
      recipient_did: d.recipient_did,
      tx_id: d.tx_id,
      amount: d.amount,
      period: d.period,
      received_at: d.received_at,
    })),
  });
}
