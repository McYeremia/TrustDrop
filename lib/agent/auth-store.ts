/**
 * Persisted Agent Auth delegation state.
 *
 * Records whether the operator (data owner) has signed an `agent-auth-update`
 * grant delegating scoped authority to the agent's own DID. The AI agent is only
 * allowed to act once this delegation is active — mirroring the T3 Agent Auth
 * model where an agent acts under explicitly granted, scoped authority and never
 * holds the owner's credentials.
 */
import { Redis } from "@upstash/redis";

export interface AgentAuthState {
  authorized: boolean;
  agentDid: string;
  operatorDid: string;
  scriptName: string;
  functions: string[];
  allowedHosts: string[];
  grantedAt: string;
}

const KEY = "trustdrop:agent-auth";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// In-memory fallback on globalThis (shared across route modules / hot-reloads).
const g = globalThis as unknown as { __trustdrop_auth?: AgentAuthState | null };

export async function getAuthState(): Promise<AgentAuthState | null> {
  if (redis) return (await redis.get<AgentAuthState>(KEY)) ?? null;
  return g.__trustdrop_auth ?? null;
}

export async function setAuthState(state: AgentAuthState): Promise<void> {
  if (redis) {
    await redis.set(KEY, state);
    return;
  }
  g.__trustdrop_auth = state;
}
