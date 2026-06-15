/**
 * Agent runtime client — the bounty's core.
 *
 * The agent has its OWN identity (AGENT_KEY), distinct from the operator. After
 * the recipient signs an `agent-auth-update` grant (see scripts/agent-money-shot.ts),
 * the agent can call `execute-disbursement` on the recipient's behalf with
 * `pii_did = recipient`. The host resolves the citizen's name INSIDE the enclave
 * and the agent only ever sees the sanitised result (status + tx_id) — never PII.
 *
 * This is the live counterpart to the hybrid demo path in /api/contract/disburse.
 */
import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from "@terminal3/t3n-sdk";

export interface AgentContext {
  t3n: T3nClient;
  did: string;
}

// Authenticating + loading the WASM component is expensive; memoize per process.
let cached: Promise<AgentContext> | null = null;

async function build(): Promise<AgentContext> {
  setEnvironment("testnet");
  const key = process.env.AGENT_KEY;
  if (!key) throw new Error("AGENT_KEY missing");

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(key);
  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, key) },
  });
  await t3n.handshake();
  const did = (await t3n.authenticate(createEthAuthInput(address))).value;
  return { t3n, did };
}

export function agentContext(): Promise<AgentContext> {
  if (!cached) cached = build().catch((e) => { cached = null; throw e; });
  return cached;
}

export interface AgentDisburseResult {
  status: string;
  tx_id: string;
  success: boolean;
  agent_did: string;
}

/**
 * The AGENT invokes execute-disbursement for a single recipient, bound as the
 * user context (`pii_did`). The contract re-verifies eligibility and recomputes
 * the authoritative amount in-enclave — the agent's only input is the DID.
 */
export async function disburseAsAgent(opts: {
  recipient_did: string;
  program_id: string;
  period: string;
  provider_url: string;
  scriptName: string;
  scriptVersion: string;
}): Promise<AgentDisburseResult> {
  const agent = await agentContext();
  const res = await agent.t3n.executeAndDecode<{
    results: Array<{ recipient_did: string; status: string; tx_id: string }>;
    success_count: number;
    fail_count: number;
  }>({
    script_name: opts.scriptName,
    script_version: opts.scriptVersion,
    function_name: "execute-disbursement",
    pii_did: opts.recipient_did,
    input: {
      period: opts.period,
      program_id: opts.program_id,
      provider_url: opts.provider_url,
      approved: [{ recipient_did: opts.recipient_did }],
    },
  });
  const row = res.results?.[0];
  return {
    status: row?.status ?? "NO_RESULT",
    tx_id: row?.tx_id ?? "",
    success: (res.success_count ?? 0) > 0,
    agent_did: agent.did,
  };
}
