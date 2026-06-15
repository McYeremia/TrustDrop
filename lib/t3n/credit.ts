/**
 * Detect a testnet "out of credit" failure from the T3N node.
 *
 * Live TEE executions (check-eligibility, map-entry-set, …) cost credits. When
 * the operator account is exhausted the node returns HTTP 403 with an
 * `InsufficientCredit` detail. We treat this as a soft, expected condition and
 * fall back to the deterministic system layer (which Fase 5 declares
 * authoritative for the demo) — clearly labelled, never disguised as a live
 * TEE result. Any other error is a real failure and must surface.
 */
export function isCreditError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /InsufficientCredit|insufficient credit/i.test(msg) ||
    (/403/.test(msg) && /forbidden/i.test(msg));
}
