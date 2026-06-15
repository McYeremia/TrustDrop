import { Redis } from "@upstash/redis";

export interface Application {
  recipient_did: string;
  /** Which aid program this application is for (Fase 5: multi-program). */
  program_id: string;
  program_name: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  tier: string;
  amount: number;
  /** Policy assessment from the issuer-attested attributes (operator still decides). */
  eligible: boolean;
  /** Why ineligible, when applicable (REGION_MISMATCH / INCOME_MISMATCH / HOUSEHOLD_MISMATCH). */
  reason?: string;
  issuers: string[];
  status: "pending" | "approved" | "rejected";
  decided_by?: string;
  decided_at?: string;
  created_at: string;
  /** Set once the provider has been paid (idempotency + UI feedback). Status
   *  stays "approved" so existing filters/stats are unaffected. */
  disbursed_at?: string;
  tx_id?: string;
  /** Evidence: which path paid this — "tee" (agent→enclave) or "system" (hybrid). */
  disbursed_source?: "tee" | "system";
  /** Evidence: live contractId that executed the disbursement (TEE path). */
  contract_id?: number;
}

const KEY = "trustdrop:applications";
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// In-memory fallback (local dev / no Redis configured). Stored on globalThis so
// it is shared across route module instances and survives dev hot-reloads —
// otherwise a write in one route is invisible to a read in another.
const g = globalThis as unknown as { __trustdrop_apps?: Map<string, Application> };
const mem: Map<string, Application> = g.__trustdrop_apps ?? (g.__trustdrop_apps = new Map());

/** A citizen may apply to several programs, so applications are keyed per pair. */
export function appKey(recipient_did: string, program_id: string): string {
  return `${recipient_did}::${program_id}`;
}

export async function upsertApplication(a: Application): Promise<void> {
  const k = appKey(a.recipient_did, a.program_id);
  if (redis) {
    await redis.hset(KEY, { [k]: a });
    return;
  }
  mem.set(k, a);
}

export async function listApplications(): Promise<Application[]> {
  const all = redis
    ? Object.values((await redis.hgetall<Record<string, Application>>(KEY)) ?? {})
    : [...mem.values()];
  // Stable, deterministic order. Redis hash field order isn't guaranteed between
  // reads, which made the polling consoles visibly reshuffle rows every refresh.
  // Sort by creation time, then by composite key as a tiebreaker.
  return all.sort((a, b) => {
    const t = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    if (t !== 0) return t;
    return appKey(a.recipient_did, a.program_id).localeCompare(
      appKey(b.recipient_did, b.program_id),
    );
  });
}

export async function getApplication(
  did: string,
  program_id: string,
): Promise<Application | null> {
  const k = appKey(did, program_id);
  if (redis) {
    const exact = await redis.hget<Application>(KEY, k);
    if (exact) return exact;
  } else {
    const exact = mem.get(k);
    if (exact) return exact;
  }
  // Fallback for legacy rows stored before composite keys (no program_id).
  const all = await listApplications();
  return (
    all.find(
      (a) =>
        a.recipient_did === did && (a.program_id === program_id || !a.program_id),
    ) ?? null
  );
}

/** Wipe all applications (demo reset). */
export async function clearApplications(): Promise<void> {
  if (redis) {
    await redis.del(KEY);
    return;
  }
  mem.clear();
}
