/**
 * diag-disburse-operator.ts — Diagnostik Temuan #2 (resolusi placeholder).
 *
 * Memakai contract & map yang SUDAH ter-provision oleh provision-flight.ts
 * (tidak register/seed ulang). Operator (punya kredit) self-grant lalu memanggil
 * `execute-disbursement` dengan DUA penerima untuk menguji apakah placeholder
 * {{profile.*}} resolve dari profil CALLER (satu orang) ke banyak penerima.
 *
 * Jalankan: npx tsx --env-file=.env.local scripts/diag-disburse-operator.ts
 *
 * Hasil yang mungkin & artinya:
 *   - PlaceholderNoUserContext / PlaceholderUnknown(field) → placeholder resolve
 *     dari profil caller; profil operator kosong. ⇒ KONFIRMASI Temuan #2:
 *     satu caller = satu profil, tak bisa berganti per-penerima.
 *   - upstream/connection error → placeholder OK tapi egress tak sampai
 *     (TEE cloud tak bisa menjangkau localhost). Tetap berarti: pakai 1 profil caller.
 *   - egress_denied → self-grant belum benar.
 *   - SUCCESS → mock provider terjangkau & profil caller ada (tak diharapkan di localhost).
 */

import {
  T3nClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const T3N_API_KEY = process.env.T3N_API_KEY!;
const CONTRACT_TAIL = "bansos-contracts";
const PERIOD = "2026-06";
// Temuan #2: host publik (TEE cloud blokir egress localhost). httpbin /anything/*
// memantulkan body POST → kita bisa LIHAT apakah {{profile.*}} ter-resolve / mentah / gagal.
// URL final = `${PROVIDER_URL}/api/mock-provider` (disuffix oleh disburse.rs:129).
const PROVIDER_URL = process.env.MOCK_PROVIDER_URL ?? "https://httpbin.org/anything";
const ALLOWED_HOSTS = [new URL(PROVIDER_URL).hostname]; // hostname MURNI diturunkan dari URL (Temuan #T2-6)

async function main() {
  if (!T3N_API_KEY) { console.error("❌ T3N_API_KEY kosong"); process.exit(1); }

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();
  const address = eth_get_address(T3N_API_KEY);
  const client = new T3nClient({
    wasmComponent: await loadWasmComponent(),
    handlers: { EthSign: metamask_sign(address, undefined, T3N_API_KEY) },
  });
  await client.handshake();
  const operatorDid = (await client.authenticate(createEthAuthInput(address))).value;
  const tenantId = operatorDid.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;
  console.log("operator:", operatorDid);
  console.log("script  :", TENANT_SCRIPT);

  const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);

  // ── Self-grant: operator (caller) izinkan dirinya egress dari contract ──
  console.log("\n[1] Self-grant agent-auth-update (agentDid = operatorDid)…");
  try {
    const userScriptVer = await getScriptVersion(nodeUrl, "tee:user/contracts");
    await client.execute({
      script_name: "tee:user/contracts",
      script_version: userScriptVer,
      function_name: "agent-auth-update",
      input: {
        agents: [{
          agentDid: operatorDid,
          scripts: [{
            scriptName: TENANT_SCRIPT,
            versionReq: tenantScriptVer,
            functions: ["check-eligibility", "prepare-batch", "execute-disbursement"],
            allowedHosts: ALLOWED_HOSTS,
          }],
        }],
      },
    });
    console.log("   ✅ self-grant OK");
  } catch (e) {
    console.log(`   ⚠️  self-grant: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Invoke execute-disbursement dengan 2 penerima ──
  console.log("\n[2] execute-disbursement (2 penerima: r001, r002)…");
  try {
    const res = await client.executeAndDecode({
      script_name: TENANT_SCRIPT,
      script_version: tenantScriptVer,
      function_name: "execute-disbursement",
      input: {
        period: PERIOD,
        provider_url: PROVIDER_URL,
        approved: [
          { recipient_did: "did:t3n:r001", amount: 500000 },
          { recipient_did: "did:t3n:r002", amount: 500000 },
        ],
      },
    });
    console.log("   ✅ hasil →", JSON.stringify(res, null, 2));
  } catch (e) {
    console.log(`   ⚠️  execute-disbursement: ${e instanceof Error ? e.message : String(e)}`);
  }
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
