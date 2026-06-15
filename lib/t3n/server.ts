import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
  getScriptVersion,
} from "@terminal3/t3n-sdk";

const CONTRACT_TAIL = "bansos-contracts";

export interface OperatorContext {
  t3n: T3nClient;
  tenant: TenantClient;
  did: string;
  tenantId: string;
  scriptName: string;
  scriptVersion: string;
  /** Live contractId (resolved from the node), needed for map ACLs. */
  contractId: number;
  nodeUrl: string;
}

// Authenticating + loading the WASM component is expensive; memoize per server
// process so repeated API calls reuse one authenticated session.
let cached: Promise<OperatorContext> | null = null;

async function build(): Promise<OperatorContext> {
  setEnvironment("testnet");
  const key = process.env.T3N_API_KEY;
  if (!key) throw new Error("T3N_API_KEY missing");

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(key);
  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, key) },
  });
  await t3n.handshake();
  const did = (await t3n.authenticate(createEthAuthInput(address))).value;

  const nodeUrl = getNodeUrl();
  const tenant = new TenantClient({ t3n, baseUrl: nodeUrl, tenantDid: did });
  const tenantId = did.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:${CONTRACT_TAIL}`;
  const scriptVersion = await getScriptVersion(nodeUrl, scriptName);

  // Resolve the live contractId (needed for private-map ACLs). Best-effort: a 0
  // here only breaks on-the-fly map creation, not the already-provisioned maps.
  let contractId = 0;
  try {
    // `contracts.list()` is present at runtime but not in the published SDK types.
    const contracts = tenant.contracts as unknown as {
      list: () => Promise<Array<{ contract_id: number; tail: string }>>;
    };
    const list = await contracts.list();
    contractId = list.find((c) => c.tail === CONTRACT_TAIL)?.contract_id ?? 0;
  } catch {
    contractId = Number(process.env.CONTRACT_ID ?? 0);
  }

  return { t3n, tenant, did, tenantId, scriptName, scriptVersion, contractId, nodeUrl };
}

export function operatorContext(): Promise<OperatorContext> {
  if (!cached) cached = build().catch((e) => { cached = null; throw e; });
  return cached;
}

/**
 * Ensure the per-program+period dedup ledger map exists with the contract-only
 * ACL the enclave needs to read/write it. Idempotent — safe to call before every
 * live disbursement (the contract errors on a missing dedup map). Fase 5: one
 * ledger per program so "disbursed for program A" never blocks program B.
 */
export async function ensureDedupMap(program_id: string, period: string): Promise<void> {
  const op = await operatorContext();
  if (op.contractId <= 0) throw new Error("contractId unresolved — cannot create dedup map ACL");
  const tail = program_id ? `disbursed-${program_id}-${period}` : `disbursed-${period}`;
  const acl = { writers: { only: [op.contractId] }, readers: { only: [op.contractId] } };
  try {
    await op.tenant.maps.create({ tail, visibility: "private", ...acl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/exist/i.test(msg)) throw e;
    // Already there → realign ACL in case a prior contractId owned it.
    await op.tenant.maps.update(tail, acl).catch(() => {});
  }
}
