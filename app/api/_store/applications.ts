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
}

const KEY = "trustdrop:applications";
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// In-memory fallback (local dev / no Redis configured).
const mem = new Map<string, Application>();

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
  if (redis) {
    const h = await redis.hgetall<Record<string, Application>>(KEY);
    return Object.values(h ?? {});
  }
  return [...mem.values()];
}

export async function getApplication(
  did: string,
  program_id: string,
): Promise<Application | null> {
  const k = appKey(did, program_id);
  if (redis) {
    return (await redis.hget<Application>(KEY, k)) ?? null;
  }
  return mem.get(k) ?? null;
}
