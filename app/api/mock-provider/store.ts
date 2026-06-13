/**
 * Ledger of disbursement requests the mock provider has received.
 *
 * This is the heart of the "money shot" proof: the TEE resolves the citizen's
 * PII (full name) inside the enclave and calls this provider with it. We record
 * exactly what arrived here — the resolved PII — and contrast it with what the
 * agent/operator saw back (only a sanitised tx_id + status).
 *
 * Persistence:
 *   - On Vercel (serverless) instances don't share memory across invocations, so
 *     we persist to Upstash Redis when its env vars are present.
 *   - Locally (no Redis env) we fall back to an in-memory ring, so `npm run dev`
 *     works with zero setup.
 *
 * Env vars (either pair works): the Vercel Upstash integration injects
 * KV_REST_API_URL / KV_REST_API_TOKEN; a direct Upstash account exposes
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 */
import { Redis } from "@upstash/redis";

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

const MAX_ENTRIES = 200;
const KEY = "trustdrop:disbursements";

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// In-memory fallback (local dev / no Redis configured).
const memory: ReceivedDisbursement[] = [];

export async function recordDisbursement(entry: ReceivedDisbursement): Promise<void> {
  if (redis) {
    await redis.lpush(KEY, entry); // client JSON-serialises objects
    await redis.ltrim(KEY, 0, MAX_ENTRIES - 1);
    return;
  }
  memory.unshift(entry);
  if (memory.length > MAX_ENTRIES) memory.length = MAX_ENTRIES;
}

/** Newest-first snapshot of received disbursements. */
export async function listDisbursements(): Promise<ReceivedDisbursement[]> {
  if (redis) {
    return (await redis.lrange<ReceivedDisbursement>(KEY, 0, MAX_ENTRIES - 1)) ?? [];
  }
  return [...memory];
}

export async function clearDisbursements(): Promise<void> {
  if (redis) {
    await redis.del(KEY);
    return;
  }
  memory.length = 0;
}
