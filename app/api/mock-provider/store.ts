/**
 * In-memory ledger of disbursement requests the mock provider has received.
 *
 * This is the heart of the "money shot" proof: the TEE resolves the citizen's
 * PII (full name) inside the enclave and calls this provider with it. We record
 * exactly what arrived here — the resolved PII — and contrast it with what the
 * agent/operator saw back (only a sanitised tx_id + status).
 *
 * Module-level state persists for the lifetime of the server process. For a
 * single-process dev server or a tunnelled (ngrok) live demo this is sufficient.
 * On serverless (Vercel) instances may not share memory across invocations —
 * swap this for Vercel KV / Upstash if cross-instance persistence is needed.
 */

export interface ReceivedDisbursement {
  /** Server-side receipt timestamp (ISO). */
  received_at: string;
  /** Provider-minted transaction id returned to the enclave. */
  tx_id: string;
  /** Recipient DID — NOT PII (a pseudonymous identifier). */
  recipient_did: string;
  /** RESOLVED PII: full name the enclave substituted from the citizen's profile. */
  recipient_name: string;
  amount: number;
  currency: string;
  period: string;
  run_id: string;
  /** Any other fields the body carried, for transparency. */
  extra: Record<string, unknown>;
}

// Bounded ring so a long-running demo can't grow without limit.
const MAX_ENTRIES = 200;
const ledger: ReceivedDisbursement[] = [];

export function recordDisbursement(entry: ReceivedDisbursement): void {
  ledger.unshift(entry);
  if (ledger.length > MAX_ENTRIES) ledger.length = MAX_ENTRIES;
}

/** Newest-first snapshot of received disbursements. */
export function listDisbursements(): ReceivedDisbursement[] {
  return [...ledger];
}

export function clearDisbursements(): void {
  ledger.length = 0;
}
