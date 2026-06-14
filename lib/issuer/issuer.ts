import * as ed from "@noble/ed25519";

// @noble/ed25519 v3: async sign/verify work out of the box; hex helpers are on
// the package. Key derivation uses Web Crypto SHA-512 (Node 18+ / browsers),
// so we need no separate hashing dependency.
const { bytesToHex, hexToBytes } = ed.etc;
const utf8 = (s: string) => new TextEncoder().encode(s);

export type IssuerId = "tax" | "civil";

const SEEDS: Record<IssuerId, string> = {
  tax: process.env.ISSUER_TAX_SEED ?? "trustdrop-dev-tax-seed-0000000000",
  civil: process.env.ISSUER_CIVIL_SEED ?? "trustdrop-dev-civil-seed-000000",
};

/** Deterministic 32-byte private key derived from the issuer's seed. */
async function privKey(issuer: IssuerId): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-512", utf8(SEEDS[issuer]));
  return new Uint8Array(digest).slice(0, 32);
}

export async function issuerPublicKey(issuer: IssuerId): Promise<string> {
  return bytesToHex(await ed.getPublicKeyAsync(await privKey(issuer)));
}

export interface Attestation {
  issuer: IssuerId;
  claims: Record<string, string>;
  issued_at: string;
  signature: string; // hex
}

/** Canonical, order-independent message bytes for signing/verifying. */
function canonical(issuer: IssuerId, claims: Record<string, string>, issued_at: string): Uint8Array {
  const body = Object.keys(claims)
    .sort()
    .map((k) => `${k}=${claims[k]}`)
    .join("&");
  return utf8(`${issuer}|${issued_at}|${body}`);
}

export async function issueAttestation(
  issuer: IssuerId,
  claims: Record<string, string>,
): Promise<Attestation> {
  const issued_at = new Date().toISOString();
  const msg = canonical(issuer, claims, issued_at);
  const sig = await ed.signAsync(msg, await privKey(issuer));
  return { issuer, claims, issued_at, signature: bytesToHex(sig) };
}

export async function verifyAttestation(att: Attestation): Promise<boolean> {
  try {
    const msg = canonical(att.issuer, att.claims, att.issued_at);
    const pub = await ed.getPublicKeyAsync(await privKey(att.issuer));
    return await ed.verifyAsync(hexToBytes(att.signature), msg, pub);
  } catch {
    return false;
  }
}
