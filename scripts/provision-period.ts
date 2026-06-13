/**
 * provision-period.ts — Create the dedup KV map for a new disbursement period.
 *
 * When you change DISBURSE_PERIOD in .env.local, the contract needs a
 * `disbursed-<period>` KV map with proper ACL. This script creates it
 * without re-running the full provisioning.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/provision-period.ts
 */

import {
  T3nClient, TenantClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const T3N_API_KEY = process.env.T3N_API_KEY;
const PERIOD = process.env.DISBURSE_PERIOD ?? "2026-07";
const CONTRACT_TAIL = "bansos-contracts";

if (!T3N_API_KEY) { console.error("❌ T3N_API_KEY kosong"); process.exit(1); }

async function main() {
  console.log(`\n🗓️  Provision dedup map for period: ${PERIOD}\n`);

  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(T3N_API_KEY!);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, T3N_API_KEY) },
  });
  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = did.value;
  console.log("   Tenant DID:", tenantDid);

  const tenant = new TenantClient({
    t3n,
    baseUrl: getNodeUrl(),
    tenantDid,
  });

  // Find current contractId
  let contractId = 0;
  try {
    const contracts = await tenant.contracts.list() as Array<{ contract_id: number; tail: string }>;
    const current = contracts.find((c) => c.tail === CONTRACT_TAIL);
    if (current) {
      contractId = current.contract_id;
      console.log(`   Contract ID: ${contractId}`);
    }
  } catch {
    console.log("   ⚠️  contracts.list() not available, trying re-register trick...");
  }

  // If we couldn't get contractId via list, try re-registering (will fail but harmlessly)
  if (contractId === 0) {
    try {
      // Try a dummy register — will fail with "version not higher" but that's OK.
      // We need to find the contractId another way, or just use a known value.
      // Fallback: read from env
      const envId = process.env.CONTRACT_ID;
      if (envId) {
        contractId = parseInt(envId, 10);
        console.log(`   Contract ID (from env): ${contractId}`);
      } else {
        console.error("   ❌ Cannot determine contractId. Set CONTRACT_ID env var or re-run provision.ts.");
        process.exit(1);
      }
    } catch {
      console.error("   ❌ Cannot determine contractId.");
      process.exit(1);
    }
  }

  const mapTail = `disbursed-${PERIOD}`;

  // Create the map with proper ACL
  try {
    await tenant.maps.create({
      tail: mapTail,
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log(`   ✅ Created map: ${mapTail}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("map already exists")) {
      console.log(`   ⏭️  Map already exists: ${mapTail}`);
    } else {
      console.error(`   ❌ Failed to create map: ${msg}`);
      throw e;
    }
  }

  // Update ACL to be safe
  try {
    await tenant.maps.update(mapTail, {
      readers: { only: [contractId] },
      writers: { only: [contractId] },
    });
    console.log(`   ✅ ACL ${mapTail} → contract ${contractId}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ⚠️  ACL update: ${msg}`);
  }

  console.log(`\n✅ Period ${PERIOD} ready. Now run onboard-recipient.ts.\n`);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
