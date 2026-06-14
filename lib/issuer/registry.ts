import registry from "@/data/issuer-registry.json";
import { issueAttestation, type Attestation } from "./issuer";

export interface Citizen {
  nik: string;
  recipient_did: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
}

export function lookupCitizen(nik: string): Citizen | null {
  return (registry as Citizen[]).find((c) => c.nik === nik) ?? null;
}

export interface AttestationBundle {
  recipient_did: string;
  attributes: { region_code: string; income_bracket: string; household_status: string };
  attestations: Attestation[];
}

/** Issuer signs the citizen's TRUE attributes — recipient cannot influence values. */
export async function attestCitizen(nik: string): Promise<AttestationBundle | null> {
  const c = lookupCitizen(nik);
  if (!c) return null;
  const [tax, civil] = await Promise.all([
    issueAttestation("tax", { income_bracket: c.income_bracket }),
    issueAttestation("civil", {
      region_code: c.region_code,
      household_status: c.household_status,
    }),
  ]);
  return {
    recipient_did: c.recipient_did,
    attributes: {
      region_code: c.region_code,
      income_bracket: c.income_bracket,
      household_status: c.household_status,
    },
    attestations: [tax, civil],
  };
}
