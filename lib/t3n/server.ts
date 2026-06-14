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

  return { t3n, tenant, did, tenantId, scriptName, scriptVersion, nodeUrl };
}

export function operatorContext(): Promise<OperatorContext> {
  if (!cached) cached = build().catch((e) => { cached = null; throw e; });
  return cached;
}
