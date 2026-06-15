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
  // Match each provider-recorded payment back to its application to surface which
  // path paid it ("tee" = live agent→enclave, "system" = hybrid).
  const sourceByTx = new Map(
    applications.filter((a) => a.tx_id).map((a) => [a.tx_id as string, a.disbursed_source]),
  );
  return NextResponse.json({
    decisions: applications.map((a) => ({
      recipient_did: a.recipient_did,
      program_id: a.program_id,
      program_name: a.program_name,
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
      source: sourceByTx.get(d.tx_id) ?? null,
    })),
  });
}
