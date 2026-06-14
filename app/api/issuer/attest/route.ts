import { NextRequest, NextResponse } from "next/server";
import { attestCitizen } from "@/lib/issuer/registry";
import { issuerPublicKey } from "@/lib/issuer/issuer";
import { previewEligibility } from "@/lib/eligibility/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { nik } = await req.json();
  const bundle = await attestCitizen(String(nik ?? ""));
  if (!bundle) {
    return NextResponse.json({ ok: false, reason: "NIK_NOT_IN_REGISTRY" }, { status: 404 });
  }
  const a = bundle.attributes;
  const preview = previewEligibility(a.region_code, a.income_bracket, a.household_status);
  const publicKeys = {
    tax: await issuerPublicKey("tax"),
    civil: await issuerPublicKey("civil"),
  };
  return NextResponse.json({ ok: true, ...bundle, preview, publicKeys });
}
