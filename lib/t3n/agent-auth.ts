/**
 * Agent Auth delegation — the T3 differentiator.
 *
 * The agent has its OWN identity (a DID derived from AGENT_KEY, distinct from the
 * operator). The operator, as data owner, signs an `agent-auth-update` grant that
 * scopes the agent to a specific contract, a set of functions, and the hosts it
 * may reach. After this, the agent acts autonomously within those bounds — never
 * holding the owner's key, never seeing PII.
 */
import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
  getScriptVersion,
} from "@terminal3/t3n-sdk";
import { operatorContext } from "./server";

const GRANT_FUNCTIONS = ["check-eligibility", "prepare-batch", "execute-disbursement"];

function allowedHosts(): string[] {
  return (process.env.MOCK_PROVIDER_HOST ?? "httpbin.org")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

// Authenticating the agent (separate identity) is expensive; memoize its DID.
let agentDidCache: Promise<string> | null = null;

/**
 * Resolve the agent's own DID by authenticating with AGENT_KEY. Returns null if
 * no agent key is configured (the UI then shows a self-grant fallback).
 */
export async function getAgentDid(): Promise<string | null> {
  const key = process.env.AGENT_KEY;
  if (!key) return null;
  if (!agentDidCache) {
    agentDidCache = (async () => {
      setEnvironment("testnet");
      const wasmComponent = await loadWasmComponent();
      const address = eth_get_address(key);
      const t3n = new T3nClient({
        wasmComponent,
        handlers: { EthSign: metamask_sign(address, undefined, key) },
      });
      await t3n.handshake();
      return (await t3n.authenticate(createEthAuthInput(address))).value;
    })().catch((e) => {
      agentDidCache = null;
      throw e;
    });
  }
  return agentDidCache;
}

export interface GrantResult {
  agentDid: string;
  operatorDid: string;
  scriptName: string;
  functions: string[];
  allowedHosts: string[];
  selfGrant: boolean;
}

/**
 * Sign the agent-auth-update grant as the operator/owner. This is a real,
 * side-effectful testnet call.
 */
export async function grantAgentAuth(): Promise<GrantResult> {
  const op = await operatorContext();
  const resolvedAgentDid = await getAgentDid();
  const agentDid = resolvedAgentDid ?? op.did; // fallback: self-grant
  const hosts = allowedHosts();

  const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");

  await op.t3n.execute({
    script_name: "tee:user/contracts",
    script_version: userContractVersion,
    function_name: "agent-auth-update",
    input: {
      agents: [
        {
          agentDid,
          scripts: [
            {
              scriptName: op.scriptName,
              versionReq: op.scriptVersion,
              functions: GRANT_FUNCTIONS,
              allowedHosts: hosts,
            },
          ],
        },
      ],
    },
  });

  return {
    agentDid,
    operatorDid: op.did,
    scriptName: op.scriptName,
    functions: GRANT_FUNCTIONS,
    allowedHosts: hosts,
    selfGrant: resolvedAgentDid === null,
  };
}

/** Read-only preview of who/what the grant would cover (no side effects). */
export async function previewGrant(): Promise<Omit<GrantResult, "selfGrant"> & { selfGrant: boolean }> {
  const op = await operatorContext();
  const resolvedAgentDid = await getAgentDid().catch(() => null);
  return {
    agentDid: resolvedAgentDid ?? op.did,
    operatorDid: op.did,
    scriptName: op.scriptName,
    functions: GRANT_FUNCTIONS,
    allowedHosts: allowedHosts(),
    selfGrant: resolvedAgentDid === null,
  };
}
