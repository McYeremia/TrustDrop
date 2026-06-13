/**
 * provision-flight.ts — Fase 1 E2E "flight" untuk memvalidasi siklus T3N.
 *
 * Tujuan (CLAUDE.md Langkah 2): buktikan register → create map → seed →
 * (grant) → invoke benar-benar jalan di TEE. Error dari provider/egress = OK
 * selama membuktikan contract dieksekusi di enclave.
 *
 * Jalankan:  npx tsx scripts/provision-flight.ts
 * Prasyarat: .env.local berisi T3N_API_KEY (operator) & AGENT_KEY (agent) ASLI.
 *
 * ── Desain bertahap (tiap stage log sendiri, lanjut walau gagal) ──────────
 *   Stage 0  Setup SDK + autentikasi OPERATOR (T3N_API_KEY) → operatorDid
 *   Stage 1  Pastikan artefak WASM ada
 *   Stage 2  Register contract (tail=bansos-contracts) → contractId
 *   Stage 3  Buat KV maps (eligibility[no-PII]/policy/secrets/audit/dedup)
 *   Stage 4  Seed eligibility (no PII) + policy + secret
 *   Stage 5  Invoke `check-eligibility`  ← TANPA grant (hanya baca KV).
 *            Berhasil = seluruh sisa Temuan #1 (map-entry-set, canonicalName,
 *            kv-store, eksekusi TEE) terbukti. Ini validasi utama Fase 1.
 *   Stage 6  FRONTIER (diagnostik): autentikasi AGENT, grant operator→agent,
 *            invoke `execute-disbursement`. Mengungkap model grant yang benar
 *            + perilaku placeholder multi-penerima (Temuan #2). Diharapkan
 *            gagal di grant ATAU egress/placeholder — semua hasil informatif.
 *
 * CATATAN: Stage 6 memakai nama fungsi grant `agent-auth-update` pada
 * `tee:user/contracts` (draf CLAUDE.md). Nama ini BELUM terverifikasi di tipe
 * SDK (lihat HACKATHON.md #T2-3) — kandidat lain: OrgDataClient.setGrants pada
 * `tee:org-data/contracts`. Flight ini sengaja mencobanya agar tahu mana benar.
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

// ─── Config ───────────────────────────────────────────────────────────────
const T3N_API_KEY = process.env.T3N_API_KEY;
const AGENT_KEY = process.env.AGENT_KEY;
const CONTRACT_TAIL = "bansos-contracts";
const CONTRACT_VERSION = "0.2.1"; // bump tiap register ulang (0.2.x = Temuan #3: map eligibility tanpa PII; .1 = realign ACL via Stage 3b)
const PERIOD = "2026-06";
const WASM_PATH = "contract/target/wasm32-wasip2/release/bansos_contracts.wasm";
// Penerima yang dijamin eligible (JKT + income low) untuk uji check-eligibility:
const TEST_RECIPIENT = "did:t3n:r001";

// allowedHosts untuk egress contract (mock provider). Sesuaikan bila host beda.
const MOCK_PROVIDER_URL = process.env.MOCK_PROVIDER_URL ?? "http://localhost:3000";
const ALLOWED_HOSTS = ["localhost:3000", "127.0.0.1:3000"];

function requireEnv(name: string, v: string | undefined): string {
  if (!v || v.includes("isi_dengan")) {
    console.error(`❌ ${name} belum diisi di .env.local`);
    process.exit(1);
  }
  return v;
}

function banner(stage: string) {
  console.log(`\n${"─".repeat(60)}\n${stage}\n${"─".repeat(60)}`);
}

/** Authenticate an eth secret → { client, did, address }. */
async function authClient(label: string, secret: string) {
  const address = eth_get_address(secret);
  const client = new T3nClient({
    wasmComponent: await loadWasmComponent(),
    handlers: { EthSign: metamask_sign(address, undefined, secret) },
  });
  await client.handshake();
  const did = (await client.authenticate(createEthAuthInput(address))).value;
  console.log(`   ${label}: address=${address}  did=${did}`);
  return { client, did, address };
}

async function main() {
  const opKey = requireEnv("T3N_API_KEY", T3N_API_KEY);

  // ── Stage 0: setup + auth operator ──
  banner("Stage 0 — Setup SDK & autentikasi OPERATOR");
  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();
  console.log("   node:", nodeUrl);
  const op = await authClient("operator", opKey);
  const operatorDid = op.did;

  const tenant = new TenantClient({ t3n: op.client, baseUrl: nodeUrl, tenantDid: operatorDid });
  const tenantId = operatorDid.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;
  console.log("   tenant script:", TENANT_SCRIPT);

  // ── Stage 1: WASM artifact ──
  banner("Stage 1 — Cek artefak WASM");
  let wasmBytes: Buffer;
  try {
    wasmBytes = (await readFile(WASM_PATH)) as unknown as Buffer;
    console.log(`   ✅ WASM ${WASM_PATH} (${wasmBytes.length} bytes)`);
  } catch {
    console.error(`   ❌ WASM tidak ditemukan. Jalankan: npm run contract:build`);
    process.exit(1);
  }

  // ── Stage 2: register ──
  banner("Stage 2 — Register contract");
  let contractId: number | undefined;
  try {
    const reg = (await tenant.contracts.register({
      tail: CONTRACT_TAIL,
      version: CONTRACT_VERSION,
      wasm: wasmBytes,
    })) as { contract_id?: number };
    contractId = reg.contract_id;
    console.log(`   ✅ Registered ${TENANT_SCRIPT} → contractId=${contractId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ⚠️  register: ${msg}`);
    console.log("   (jika 'version not higher', bump CONTRACT_VERSION lalu ulang)");
  }

  // ── Stage 3: create maps ──
  banner("Stage 3 — Buat KV maps");
  // Temuan #3 (LUNAS): contract HANYA membaca `eligibility` (tanpa PII).
  // Tidak ada map `recipients` ber-PII — PII tinggal di profil T3N tiap penerima
  // dan hanya di-resolve via {{profile.*}} saat disbursement. disbursed-<period> = dedup.
  const maps = ["eligibility", "policy", "secrets", "audit", `disbursed-${PERIOD}`];
  const acl =
    contractId !== undefined
      ? { writers: { only: [contractId] }, readers: { only: [contractId] } }
      : { writers: "all" as const, readers: "all" as const }; // fallback bila contractId tak diketahui
  for (const tail of maps) {
    try {
      await tenant.maps.create({ tail, visibility: "private", ...acl });
      console.log(`   ✅ map ${tail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(msg.includes("exist") ? `   ⏭️  map ${tail} sudah ada` : `   ⚠️  map ${tail}: ${msg}`);
    }
  }

  // ── Stage 3b: SELARASKAN ACL map ke contractId terkini (Temuan #T2-7) ──
  // Re-register (bump versi) → contractId BARU. Map privat yang dibuat untuk
  // contractId lama menolak contract baru (`cannot read map`). `maps.create`
  // dilewati bila map sudah ada → ACL lama tetap. `maps.update` memperbaiki ACL
  // TANPA menghapus data. Idempoten: aman dijalankan tiap kali.
  if (contractId !== undefined) {
    banner("Stage 3b — Selaraskan ACL map ke contractId terkini");
    for (const tail of maps) {
      try {
        await tenant.maps.update(tail, {
          readers: { only: [contractId] },
          writers: { only: [contractId] },
        });
        console.log(`   ✅ ACL ${tail} → reader/writer = contract ${contractId}`);
      } catch (e) {
        console.log(`   ⚠️  ACL ${tail}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ── Stage 4: seed ──
  banner("Stage 4 — Seed data");
  const setEntry = (tail: string, key: string, value: unknown) =>
    tenant.executeControl("map-entry-set", {
      map_name: tenant.canonicalName(tail),
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    });

  const recipients = JSON.parse(await readFile("data/recipients.json", "utf-8")) as Array<{
    recipient_did: string;
    region_code: string;
    income_bracket: string;
    [k: string]: unknown;
  }>;

  try {
    // eligibility (TANPA PII) — satu-satunya data penerima yang dibaca contract.
    // Proyeksikan HANYA recipient_did/region_code/income_bracket; field PII
    // (bank_account/legal_name/nik) sengaja TIDAK pernah masuk map ini.
    await setEntry("eligibility", "_index", recipients.map((r) => r.recipient_did));
    for (const r of recipients)
      await setEntry("eligibility", r.recipient_did, {
        recipient_did: r.recipient_did,
        region_code: r.region_code,
        income_bracket: r.income_bracket,
      });
    // policy
    await setEntry("policy", "current", {
      eligible_regions: ["JKT", "BDG", "SBY", "SMG"],
      eligible_income_bracket: "low",
      amount_per_recipient: 500000,
      total_budget: 5000000,
      period: PERIOD,
      dedup: true,
    });
    // secret (mock)
    await setEntry("secrets", "provider_api_key", "mock_provider_key_for_hackathon");
    console.log(`   ✅ seeded eligibility (${recipients.length}, no PII) + policy + secret`);
  } catch (e) {
    console.log(`   ❌ seed gagal: ${e instanceof Error ? e.message : String(e)}`);
    console.log("   (jika nama fungsi 'map-entry-set' ditolak → catat sebagai Temuan Track 2)");
  }

  // ── Stage 5: invoke check-eligibility (NO grant needed) ──
  banner("Stage 5 — Invoke check-eligibility (tanpa grant) ★ validasi utama");
  try {
    const scriptVersion = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
    console.log("   script version:", scriptVersion);
    const res = await op.client.executeAndDecode({
      script_name: TENANT_SCRIPT,
      script_version: scriptVersion,
      function_name: "check-eligibility",
      input: { recipient_did: TEST_RECIPIENT },
    });
    console.log("   ✅ check-eligibility OK →", JSON.stringify(res));
    console.log("   ⇒ Siklus T3N TERBUKTI: register+map-create+map-entry-set+kv-store+TEE exec jalan.");
  } catch (e) {
    console.log(`   ❌ check-eligibility: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Stage 6: FRONTIER — agent delegation + disbursement (diagnostik) ──
  banner("Stage 6 — FRONTIER: grant operator→agent + execute-disbursement");
  if (!AGENT_KEY) {
    console.log("   ⏭️  AGENT_KEY kosong → lewati Stage 6 (Jalan A / self-grant saja).");
  } else {
    let agentDid = "";
    try {
      const agent = await authClient("agent", AGENT_KEY);
      agentDid = agent.did;

      // 6a) Operator menandatangani grant agent→contract (DRAF — nama belum terverifikasi)
      console.log("\n   [6a] Coba grant 'agent-auth-update' (tee:user/contracts)…");
      try {
        const userScriptVer = await getScriptVersion(nodeUrl, "tee:user/contracts");
        const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
        await op.client.execute({
          script_name: "tee:user/contracts",
          script_version: userScriptVer,
          function_name: "agent-auth-update",
          input: {
            agents: [
              {
                agentDid,
                scripts: [
                  {
                    scriptName: TENANT_SCRIPT,
                    versionReq: tenantScriptVer,
                    functions: ["check-eligibility", "prepare-batch", "execute-disbursement"],
                    allowedHosts: ALLOWED_HOSTS,
                  },
                ],
              },
            ],
          },
        });
        console.log("   ✅ grant agent-auth-update diterima (nama fungsi TERVERIFIKASI).");
      } catch (e) {
        console.log(`   ⚠️  agent-auth-update gagal: ${e instanceof Error ? e.message : String(e)}`);
        console.log("   ⇒ Catat ke Track 2: nama/skema grant kemungkinan beda (cek OrgDataClient.setGrants).");
      }

      // 6b) Agent invoke execute-disbursement (egress + placeholder)
      console.log("\n   [6b] Agent invoke execute-disbursement…");
      const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
      const res = await agent.client.executeAndDecode({
        script_name: TENANT_SCRIPT,
        script_version: tenantScriptVer,
        function_name: "execute-disbursement",
        input: {
          period: PERIOD,
          provider_url: MOCK_PROVIDER_URL,
          approved: [{ recipient_did: TEST_RECIPIENT, amount: 500000 }],
        },
      });
      console.log("   ✅ execute-disbursement →", JSON.stringify(res));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`   ⚠️  execute-disbursement: ${msg}`);
      console.log("   ⇒ Diharapkan: egress_denied (grant) ATAU placeholder (profil caller kosong).");
      console.log("     Keduanya informatif — egress_denied=grant belum benar; placeholder=Temuan #2.");
    }
  }

  banner("Flight selesai — baca log tiap stage di atas");
  console.log(`operator : ${operatorDid}`);
  console.log(`script   : ${TENANT_SCRIPT}  (contractId=${contractId})`);
  console.log(`period   : ${PERIOD}`);
}

main().catch((err) => {
  console.error("\n❌ Flight gagal total:", err);
  process.exit(1);
});
