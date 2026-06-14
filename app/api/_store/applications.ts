import { Redis } from "@upstash/redis";

export interface Application {
  recipient_did: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  tier: string;
  amount: number;
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

export async function upsertApplication(a: Application): Promise<void> {
  if (redis) {
    await redis.hset(KEY, { [a.recipient_did]: a });
    return;
  }
  mem.set(a.recipient_did, a);
}

export async function listApplications(): Promise<Application[]> {
  if (redis) {
    const h = await redis.hgetall<Record<string, Application>>(KEY);
    return Object.values(h ?? {});
  }
  return [...mem.values()];
}

export async function getApplication(did: string): Promise<Application | null> {
  if (redis) {
    return (await redis.hget<Application>(KEY, did)) ?? null;
  }
  return mem.get(did) ?? null;
}
