import { NextRequest, NextResponse } from "next/server";
import { getApplication, upsertApplication, listApplications } from "@/app/api/_store/applications";
import { operatorContext } from "@/lib/t3n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
 try {
  const { recipient_did, program_id, decision } = await req.json();
  const app = await getApplication(recipient_did, program_id);
  if (!app) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  if (decision === "reject") {
    await upsertApplication({ ...app, status: "rejected", decided_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // APPROVE → seed the PII-free eligibility record into KV via the operator SDK.
  const op = await operatorContext();
  const record = {
    recipient_did: app.recipient_did,
    region_code: app.region_code,
    income_bracket: app.income_bracket,
    household_status: app.household_status,
    attested: true,
  };
  await op.tenant.executeControl("map-entry-set", {
    map_name: op.tenant.canonicalName("eligibility"),
    key: app.recipient_did,
    value: JSON.stringify(record),
  });

  // Rebuild the eligibility _index from all approved recipients (incl. this one).
  await upsertApplication({
    ...app,
    status: "approved",
    decided_by: op.did,
    decided_at: new Date().toISOString(),
  });
  const approvedDids = (await listApplications())
    .filter((a) => a.status === "approved")
    .map((a) => a.recipient_did);
  await op.tenant.executeControl("map-entry-set", {
    map_name: op.tenant.canonicalName("eligibility"),
    key: "_index",
    value: JSON.stringify(approvedDids),
  });

  return NextResponse.json({ ok: true, status: "approved", record });
 } catch (e) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : String(e) },
    { status: 200 },
  );
 }
}
