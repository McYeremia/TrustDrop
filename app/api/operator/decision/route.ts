import { NextRequest, NextResponse } from "next/server";
import { getApplication, upsertApplication, listApplications } from "@/app/api/_store/applications";
import { operatorContext } from "@/lib/t3n/server";
import { isCreditError } from "@/lib/t3n/credit";

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

  // Mark approved locally first so the decision survives even if the live KV
  // seed can't run (e.g. the testnet account is out of credit).
  await upsertApplication({
    ...app,
    status: "approved",
    decided_by: op.did,
    decided_at: new Date().toISOString(),
  });

  // Best-effort: push the eligibility record + rebuilt index into the TEE KV.
  // On InsufficientCredit we keep the local approval and report tee_synced:false
  // rather than failing the operator's action.
  let tee_synced = true;
  let warning: string | undefined;
  try {
    await op.tenant.executeControl("map-entry-set", {
      map_name: op.tenant.canonicalName("eligibility"),
      key: app.recipient_did,
      value: JSON.stringify(record),
    });
    const approvedDids = (await listApplications())
      .filter((a) => a.status === "approved")
      .map((a) => a.recipient_did);
    await op.tenant.executeControl("map-entry-set", {
      map_name: op.tenant.canonicalName("eligibility"),
      key: "_index",
      value: JSON.stringify(approvedDids),
    });
  } catch (e) {
    if (!isCreditError(e)) throw e;
    tee_synced = false;
    warning = "approved locally — TEE KV not synced (no testnet credit)";
  }

  return NextResponse.json({ ok: true, status: "approved", record, tee_synced, warning });
 } catch (e) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : String(e) },
    { status: 200 },
  );
 }
}
