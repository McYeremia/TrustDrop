/**
 * provision.ts — One-shot provisioning script for TrustDrop.
 *
 * Run with: npx tsx scripts/provision.ts
 *
 * What it does (in order):
 *   1. Connect to T3N testnet, authenticate, get tenantDid
 *   2. Build the contract WASM (cargo build)
 *   3. Register the contract
 *   4. Create KV maps: secrets, eligibility (no PII), policy, disbursed-<period>, audit
 *   5. Seed PII-free eligibility records from data/recipients.json (projection only)
 *   6. Seed default policy
 *   7. Self-grant egress for all 3 functions
 *
 * Prerequisites:
 *   - .env.local with T3N_API_KEY filled in
 *   - Rust toolchain with wasm32-wasip2 target
 */

import { readFile } from "fs/promises";
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

// Load env
const T3N_API_KEY = process.env.T3N_API_KEY;
if (!T3N_API_KEY || T3N_API_KEY === "isi_dengan_developer_key_dari_claim_page") {
  console.error("❌ T3N_API_KEY not set in .env.local — get it from https://www.terminal3.io/claim-page");
  process.exit(1);
}

const CONTRACT_TAIL = "bansos-contracts";
const CONTRACT_VERSION = "0.4.0"; // 0.4.0 = multi-program (policy keyed by program_id) + in-enclave disburse re-verify
const DISBURSEMENT_PERIOD = process.env.DISBURSE_PERIOD ?? "2026-07";

interface ProgramDef {
  program_id: string;
  name: string;
  criteria: { regions: string[]; income_brackets: string[]; household_statuses?: string[] };
  benefit: { mode: "tier" | "flat"; flat_amount?: number };
  budget: number;
  period: string;
}

/** Load the program registry shared with the app (data/programs.json). */
async function loadPrograms(): Promise<ProgramDef[]> {
  const raw = await readFile(new URL("../data/programs.json", import.meta.url), "utf8");
  return JSON.parse(raw) as ProgramDef[];
}

/** Build the KV policy record the contract expects, from a program definition. */
function policyRecord(p: ProgramDef) {
  return {
    eligible_regions: p.criteria.regions,
    eligible_income_brackets: p.criteria.income_brackets,
    eligible_household_statuses: p.criteria.household_statuses ?? [],
    flat_amount: p.benefit.mode === "flat" ? (p.benefit.flat_amount ?? 0) : 0,
    total_budget: p.budget,
    period: p.period,
    dedup: true,
  };
}

async function main() {
  console.log("🚀 TrustDrop Provisioning Script");
  console.log("================================\n");

  // ─── 1. Setup SDK ───
  console.log("1️⃣  Setting up T3N SDK...");
  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(T3N_API_KEY!); // dijamin ada oleh guard di atas
  console.log("   Address:", address);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, T3N_API_KEY),
    },
  });

  // ─── 2. Authenticate ───
  console.log("2️⃣  Authenticating to T3N testnet...");
  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = did.value;
  console.log("   Tenant DID:", tenantDid);

  const tenant = new TenantClient({
    t3n,
    baseUrl: getNodeUrl(),
    tenantDid,
  });

  // ─── 3. Register contract ───
  console.log("3️⃣  Registering contract...");
  const WASM_PATH = "contract/target/wasm32-wasip2/release/bansos_contracts.wasm";
  let wasmBytes: Buffer;
  try {
    wasmBytes = await readFile(WASM_PATH) as unknown as Buffer;
  } catch {
    console.error(`   ❌ WASM file not found at ${WASM_PATH}`);
    console.error("   Run: cd contract && cargo build --target wasm32-wasip2 --release");
    process.exit(1);
  }

  let contractId: number;
  try {
    const result = (await tenant.contracts.register({
      tail: CONTRACT_TAIL,
      version: CONTRACT_VERSION,
      wasm: wasmBytes,
    })) as { contract_id: number };
    contractId = result.contract_id;
    const tenantId = tenantDid.slice("did:t3n:".length);
    console.log(`   ✅ Registered z:${tenantId}:${CONTRACT_TAIL} → contractId: ${contractId}`);
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (errorMsg.includes("version") && errorMsg.includes("not higher")) {
      console.log(`   ⚠️  Contract already registered at version ${CONTRACT_VERSION} — bump version to re-register`);
      // Try to get existing contract info; for now, use a placeholder
      contractId = 0; // Will need the actual ID from a previous run
      console.log("   ⚠️  Using contractId = 0 — if maps fail, check your contract ID");
    } else {
      throw e;
    }
  }

  // ─── 4. Create KV maps ───
  console.log("4️⃣  Creating KV maps...");
  const programs = await loadPrograms();
  // One dedup ledger per program + period (Fase 5).
  const dedupMaps = programs.map((p) => `disbursed-${p.program_id}-${p.period}`);
  const maps = ["secrets", "eligibility", "policy", `disbursed-${DISBURSEMENT_PERIOD}`, "audit", ...dedupMaps];

  for (const tail of maps) {
    try {
      await tenant.maps.create({
        tail,
        visibility: "private",
        writers: { only: [contractId] },
        readers: { only: [contractId] },
      });
      console.log(`   ✅ Created map: ${tail}`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.includes("map already exists")) {
        console.log(`   ⏭️  Map already exists: ${tail}`);
      } else {
        console.error(`   ❌ Failed to create map ${tail}:`, errorMsg);
        throw e;
      }
    }
  }

  // ─── 4b. Realign map ACL to current contractId (Temuan #T2-7) ───
  // Re-register (bump version) → NEW contractId. Maps created for the OLD id
  // deny the new contract ("cannot read map"); `maps.create` is skipped when a
  // map exists so its ACL goes stale. `maps.update` repairs the ACL without
  // deleting data. Idempotent — safe to run every time.
  if (contractId > 0) {
    console.log("4️⃣b Realigning map ACL to current contractId...");
    for (const tail of maps) {
      try {
        await tenant.maps.update(tail, {
          readers: { only: [contractId] },
          writers: { only: [contractId] },
        });
        console.log(`   ✅ ACL ${tail} → contract ${contractId}`);
      } catch (e: unknown) {
        console.log(`   ⚠️  ACL ${tail}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ─── 5. Initialise an EMPTY eligibility map ───
  // In the v0.3.0 model recipients are NOT pre-seeded. A recipient self-applies
  // with issuer-signed attestations; the operator approves; only then is their
  // PII-free eligibility record written (by the operator-decision API route).
  // Here we just initialise an empty index so the contract can read it.
  console.log("5️⃣  Initialising empty eligibility map (filled via approval)...");
  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("eligibility"),
    key: "_index",
    value: JSON.stringify([]),
  });
  console.log("   ✅ eligibility _index initialised to []");

  // ─── 6. Seed per-program policy (key = program_id; contract decides amounts) ───
  console.log("6️⃣  Seeding per-program policy...");
  for (const p of programs) {
    await tenant.executeControl("map-entry-set", {
      map_name: tenant.canonicalName("policy"),
      key: p.program_id,
      value: JSON.stringify(policyRecord(p)),
    });
    console.log(`   ✅ policy[${p.program_id}] — ${p.name}`);
  }
  // Legacy "current" key kept for backward compatibility (single-program callers).
  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("policy"),
    key: "current",
    value: JSON.stringify({
      eligible_regions: ["JKT", "BDG", "SBY", "SMG"],
      eligible_income_brackets: ["low", "medium"],
      eligible_household_statuses: [],
      flat_amount: 0,
      total_budget: 50000000,
      period: DISBURSEMENT_PERIOD,
      dedup: true,
    }),
  });
  console.log("   ✅ legacy policy[current] seeded");

  // ─── 7. Seed mock provider "API key" into secrets ───
  console.log("7️⃣  Seeding mock provider key into secrets...");
  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("secrets"),
    key: "provider_api_key",
    value: "mock_provider_key_for_hackathon",
  });
  console.log("   ✅ Mock provider key sealed in secrets");

  // ─── 8. Self-grant for egress ───
  console.log("8️⃣  Granting egress permissions...");
  const tenantId = tenantDid.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;

  try {
    const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");
    const scriptVersion = await getScriptVersion(getNodeUrl(), TENANT_SCRIPT);

    await t3n.execute({
      script_name: "tee:user/contracts",
      script_version: userContractVersion,
      function_name: "agent-auth-update",
      input: {
        agents: [{
          agentDid: tenantDid,  // self-grant
          scripts: [{
            scriptName: TENANT_SCRIPT,
            versionReq: scriptVersion,
            functions: ["check-eligibility", "prepare-batch", "execute-disbursement"],
            allowedHosts: (process.env.MOCK_PROVIDER_HOST ?? "httpbin.org").split(","), // hostname MURNI (Temuan #T2-6); loopback diblokir TEE
          }],
        }],
      },
    });
    console.log("   ✅ Self-grant for egress OK");
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("   ❌ Grant failed:", errorMsg);
    console.log("   ⚠️  This may be because the contract isn't registered yet or the version doesn't match");
  }

  // ─── Done ───
  console.log("\n================================");
  console.log("✅ Provisioning complete!");
  console.log("================================");
  console.log(`\nTenant DID    : ${tenantDid}`);
  console.log(`Contract ID   : ${contractId}`);
  console.log(`Script Name   : ${TENANT_SCRIPT}`);
  console.log(`Period        : ${DISBURSEMENT_PERIOD}`);
  console.log(`Eligibility   : empty (filled via operator approval)`);
  console.log(`\nNext: npm run dev`);
}

main().catch((err) => {
  console.error("\n❌ Provisioning failed:", err);
  process.exit(1);
});
