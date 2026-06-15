import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

/**
 * Per-IP fixed-window rate limiter for the public Groq-backed endpoints.
 *
 * TrustDrop's demo is open to the world on Vercel, so the LLM routes (agent
 * orchestration + recipient explanation) need a ceiling to stop anyone from
 * draining the Groq quota by hammering them. We reuse the Upstash Redis that is
 * already configured; when it isn't (local dev), the limiter fails OPEN so the
 * app still works without a Redis. This is a cost guard, not an auth boundary.
 */

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when ok === false). */
  retryAfter: number;
}

/** Best-effort client IP from Vercel/proxy headers. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Allow up to `limit` requests per `windowSec` for a given (bucket, ip) pair.
 * Returns { ok: true } when within budget. Fails open if Redis is unavailable.
 */
export async function rateLimit(
  bucket: string,
  ip: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  if (!redis) return { ok: true, retryAfter: 0 };

  const key = `rl:${bucket}:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First hit in this window — start the TTL.
      await redis.expire(key, windowSec);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      return { ok: false, retryAfter: ttl > 0 ? ttl : windowSec };
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    // Never let a limiter outage take down the endpoint.
    return { ok: true, retryAfter: 0 };
  }
}
