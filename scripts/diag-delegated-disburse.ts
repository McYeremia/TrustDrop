/**
 * diag-delegated-disburse.ts — Diagnostik Agent Auth money shot (1 penerima).
 *
 * Menguji rantai delegasi yang BENAR untuk kontrak custom kita (bukan payroll):
 *   operator (berkredit) bertindak ATAS NAMA penerima → host mengikat
 *   pii_did=penerima → {{profile.bank_account}} resolve ke rekening PENERIMA,
 *   sementara contract & operator tak pernah memegang plaintext-nya.
 *
 * Jalankan: npx tsx --env-file=.env.local scripts/diag-delegated-disburse.ts
 *
 * Tahapan (tiap tahap log; berhenti/lanjut sesuai hasil — semua informatif):
 *   1. Auth OPERATOR (T3N_API_KEY) — aktor berkredit.
 *   2. Buat identitas PENERIMA baru (eth key acak, ephemeral) + auth.
 *   3. PENERIMA submitUserInput({first_name,bank_account}, becomeDevTenant)
 *      → uji apakah profil bisa dibuat tanpa email-verify; catat grantedCredits.
 *   4. PENERIMA tandatangan agent-auth-update → beri wewenang OPERATOR utk
 *      execute-disbursement pada contract kita + allowedHosts httpbin.
 *   5. OPERATOR invoke execute-disbursement dgn pii_did=penerima.
 *      - SUCCESS  → placeholder resolve dari profil PENERIMA (≠ operator). MONEY SHOT.
 *      - placeholder-unknown(bank_account) → pii_did delegasi TIDAK mengikat profil
 *        penerima (resolve dari caller/operator). ⇒ catat sbg temuan.
 *      - egress_denied → grant/allowedHosts belum benar.
 *
 * CATATAN: contract men-sanitasi respons provider (hanya status/tx_id keluar),
 * jadi rekening TIDAK terlihat dari sisi pemanggil (memang itu tujuannya).
 * SUCCESS (vs placeholder-unknown saat profil operator kosong di diag sebelumnya)
 * = bukti resolusi profil per-penerima bekerja.
 */

import { randomBytes } from "crypto";
import {
  T3nClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const T3N_API_KEY = process.env.T3N_API_KEY;
const CONTRACT_TAIL = "bansos-contracts";
const PERIOD = "2026-06";
const PROVIDER_URL = process.env.MOCK_PROVIDER_URL ?? "https://httpbin.org/anything";
const ALLOWED_HOSTS = ["httpbin.org"];

// Profil PII sintetis untuk penerima uji (hanya di profil T3N penerima):
const RECIPIENT_PROFILE = {
  first_name: "Budi",
  bank_account: "1234567890",
};

function banner(s: string) { console.log(`\n${"─".repeat(60)}\n${s}\n${"─".repeat(60)}`); }

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
  if (!T3N_API_KEY) { console.error("❌ T3N_API_KEY kosong"); process.exit(1); }

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();

  // ── 1. Operator ──
  banner("1 — Auth OPERATOR (aktor berkredit)");
  const op = await authClient("operator", T3N_API_KEY);
  const tenantId = op.did.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;
  console.log("   script:", TENANT_SCRIPT);
  const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
  console.log("   contract version:", tenantScriptVer);

  // ── 2. Penerima baru ──
  banner("2 — Buat identitas PENERIMA baru (ephemeral)");
  const recipientKey = "0x" + randomBytes(32).toString("hex");
  console.log("   (private key penerima ephemeral — tidak disimpan)");
  const rcpt = await authClient("recipient", recipientKey);

  // ── 3. Profil penerima + self-admit ──
  banner("3 — PENERIMA submitUserInput(profile, becomeDevTenant)");
  try {
    const res = await rcpt.client.submitUserInput({
      profile: RECIPIENT_PROFILE,
      becomeDevTenant: true,
    });
    console.log("   ✅ submitUserInput OK:", JSON.stringify(res));
    if (res.tenantAdmit) console.log("   tenantAdmit:", JSON.stringify(res.tenantAdmit));
    if (res.refusedFields?.length) console.log("   ⚠️ refusedFields:", res.refusedFields);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ❌ submitUserInput: ${msg}`);
    console.log("   ⇒ Jika EmailNotVerified → profil sintetis butuh OTP/email-verify (catat sbg temuan).");
  }

  // ── 4. Penerima beri grant ke operator ──
  banner("4 — PENERIMA agent-auth-update → wewenang OPERATOR");
  try {
    const userScriptVer = await getScriptVersion(nodeUrl, "tee:user/contracts");
    await rcpt.client.execute({
      script_name: "tee:user/contracts",
      script_version: userScriptVer,
      function_name: "agent-auth-update",
      input: {
        agents: [{
          agentDid: op.did, // operator = aktor yg diberi wewenang bertindak utk penerima
          scripts: [{
            scriptName: TENANT_SCRIPT,
            versionReq: tenantScriptVer,
            functions: ["execute-disbursement"],
            allowedHosts: ALLOWED_HOSTS,
          }],
        }],
      },
    });
    console.log("   ✅ grant penerima→operator OK");
  } catch (e) {
    console.log(`   ⚠️ grant: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 5. Operator invoke ATAS NAMA penerima (pii_did) ──
  banner("5 — OPERATOR execute-disbursement (pii_did = penerima)");
  try {
    const res = await op.client.executeAndDecode({
      script_name: TENANT_SCRIPT,
      script_version: tenantScriptVer,
      function_name: "execute-disbursement",
      pii_did: rcpt.did, // ← bertindak atas nama penerima; host ikat profilnya
      input: {
        period: PERIOD,
        provider_url: PROVIDER_URL,
        approved: [{ recipient_did: rcpt.did, amount: 500000 }],
      },
    });
    console.log("   ✅ hasil →", JSON.stringify(res, null, 2));
    console.log("   ⇒ Jika status SUCCESS: placeholder resolve dari profil PENERIMA → MONEY SHOT.");
  } catch (e) {
    console.log(`   ⚠️ execute-disbursement: ${e instanceof Error ? e.message : String(e)}`);
  }

  banner("Diagnostik selesai");
  console.log("operator :", op.did);
  console.log("recipient:", rcpt.did);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
