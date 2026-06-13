/**
 * onboard-recipient.ts — Money shot Fase 2: onboard 1 penerima demo (email-verify)
 * lalu uji pencairan yang me-resolve rekening PENERIMA di dalam enclave.
 *
 * Identitas penerima persisten dibaca dari RECIPIENT_KEY (.env.local) → DID tetap.
 * Profil PII (first_name, bank_account) di-set HANYA di profil T3N penerima;
 * contract & operator tak pernah memegang plaintext-nya.
 *
 * SATU PROSES INTERAKTIF (penting): state OTP terikat ke SESI. Karena itu
 * request → (tunggu kode) → verify HARUS dalam satu proses/sesi yang sama —
 * skrip menunggu Anda mengetik kode yg masuk ke email, sesi penerima tetap hidup.
 *
 * Jalankan (di terminal Anda agar bisa mengetik kode):
 *   npx tsx --env-file=.env.local scripts/onboard-recipient.ts <email>
 *
 * Tahapan:
 *   1. Auth penerima → kirim OTP ke email.
 *   2. Tunggu Anda ketik kode (stdin) → otpVerify (sesi sama).
 *   3. submitUserInput({first_name,bank_account}, becomeDevTenant) → commit profil
 *      + self-admit testnet; catat grantedCredits + saldo.
 *   4. DELEGASI: penerima agent-auth-update→operator; operator execute-disbursement
 *      pii_did=penerima (profil KINI ada). SUCCESS = money shot.
 *   5. Fallback: penerima self-grant + self-call (butuh welcome credits).
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  T3nClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const T3N_API_KEY = process.env.T3N_API_KEY;
const RECIPIENT_KEY = process.env.RECIPIENT_KEY;
const CONTRACT_TAIL = "bansos-contracts";
const PERIOD = "2026-06";
const PROVIDER_URL = process.env.MOCK_PROVIDER_URL ?? "https://httpbin.org/anything";
const ALLOWED_HOSTS = ["httpbin.org"];
const RECIPIENT_PROFILE = { first_name: "Budi", bank_account: "1234567890" };

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

async function balanceOf(client: T3nClient, label: string) {
  try {
    const usage = await client.getUsage();
    console.log(`   saldo ${label}:`, JSON.stringify((usage as { balance?: unknown }).balance));
  } catch (e) {
    console.log(`   saldo ${label}: (gagal baca) ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  const email = process.argv[2];
  if (!T3N_API_KEY) { console.error("❌ T3N_API_KEY kosong"); process.exit(1); }
  if (!RECIPIENT_KEY) { console.error("❌ RECIPIENT_KEY kosong (.env.local)"); process.exit(1); }
  if (!email) { console.error("Pakai: onboard-recipient.ts <email>"); process.exit(1); }

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();

  // ── 1. Auth penerima + kirim OTP (SESI yg sama dipakai sampai verify) ──
  banner("1 — Auth penerima + kirim OTP");
  const rcpt = await authClient("recipient", RECIPIENT_KEY);
  const reqRes = await rcpt.client.otpRequest({ emailChannel: { emailAddress: email } });
  console.log("   ✅ OTP dikirim:", JSON.stringify(reqRes));

  // ── 2. Tunggu kode dari stdin → verify (sesi penerima TETAP hidup) ──
  banner("2 — Masukkan kode OTP dari email");
  const rl = createInterface({ input, output });
  const code = (await rl.question(`   Kode OTP utk ${email}: `)).trim();
  rl.close();
  try {
    const v = await rcpt.client.otpVerify({ otpCode: code, request: { emailChannel: { emailAddress: email } } });
    console.log("   ✅ otpVerify:", JSON.stringify(v));
    if (v.status) { console.log("   ❌ status:", v.status, "→ kode salah/kedaluwarsa. Ulangi skrip."); return; }
  } catch (e) {
    console.log(`   ❌ otpVerify: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // ── 3. Profil PII + becomeDevTenant ──
  banner("3 — submitUserInput (profil PII + becomeDevTenant)");
  try {
    const r = await rcpt.client.submitUserInput({ profile: RECIPIENT_PROFILE, becomeDevTenant: true });
    console.log("   ✅ submitUserInput:", JSON.stringify(r));
    if (r.tenantAdmit) console.log("   tenantAdmit:", JSON.stringify(r.tenantAdmit));
  } catch (e) {
    console.log(`   ❌ submitUserInput: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  await balanceOf(rcpt.client, "penerima");

  // ── Auth operator (aktor berkredit) ──
  banner("4 — Auth operator + siapkan pencairan");
  const op = await authClient("operator", T3N_API_KEY);
  const tenantId = op.did.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;
  const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
  const userScriptVer = await getScriptVersion(nodeUrl, "tee:user/contracts");
  console.log("   script:", TENANT_SCRIPT, "v" + tenantScriptVer);

  // ── 4d. DELEGASI: penerima grant operator → operator cairkan (pii_did=penerima) ──
  banner("4d — DELEGASI: operator cairkan atas nama penerima (pii_did=penerima)");
  try {
    await rcpt.client.execute({
      script_name: "tee:user/contracts", script_version: userScriptVer,
      function_name: "agent-auth-update",
      input: { agents: [{ agentDid: op.did, scripts: [{
        scriptName: TENANT_SCRIPT, versionReq: tenantScriptVer,
        functions: ["execute-disbursement"], allowedHosts: ALLOWED_HOSTS,
      }] }] },
    });
    console.log("   ✅ grant penerima→operator OK");
  } catch (e) {
    console.log(`   ⚠️ grant: ${e instanceof Error ? e.message : String(e)}`);
  }
  let delegatedOk = false;
  try {
    const res = await op.client.executeAndDecode<{ success_count: number }>({
      script_name: TENANT_SCRIPT, script_version: tenantScriptVer,
      function_name: "execute-disbursement", pii_did: rcpt.did,
      input: { period: PERIOD, provider_url: PROVIDER_URL,
        approved: [{ recipient_did: rcpt.did, amount: 500000 }] },
    });
    console.log("   hasil (delegasi) →", JSON.stringify(res));
    delegatedOk = (res.success_count ?? 0) > 0;
  } catch (e) {
    console.log(`   ⚠️ delegasi: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (delegatedOk) {
    banner("✅ MONEY SHOT (delegasi): rekening penerima ter-resolve di enclave");
  } else {
    // ── 5. Fallback self-call (butuh welcome credits) ──
    banner("5 — Fallback SELF-CALL: penerima cairkan utk dirinya (butuh kredit)");
    try {
      await rcpt.client.execute({
        script_name: "tee:user/contracts", script_version: userScriptVer,
        function_name: "agent-auth-update",
        input: { agents: [{ agentDid: rcpt.did, scripts: [{
          scriptName: TENANT_SCRIPT, versionReq: tenantScriptVer,
          functions: ["execute-disbursement"], allowedHosts: ALLOWED_HOSTS,
        }] }] },
      });
      console.log("   ✅ self-grant penerima OK");
      const res = await rcpt.client.executeAndDecode<{ success_count: number }>({
        script_name: TENANT_SCRIPT, script_version: tenantScriptVer,
        function_name: "execute-disbursement",
        input: { period: PERIOD, provider_url: PROVIDER_URL,
          approved: [{ recipient_did: rcpt.did, amount: 500000 }] },
      });
      console.log("   hasil (self-call) →", JSON.stringify(res));
      if ((res.success_count ?? 0) > 0) banner("✅ MONEY SHOT (self-call): profil penerima ter-resolve di enclave");
    } catch (e) {
      console.log(`   ⚠️ self-call: ${e instanceof Error ? e.message : String(e)}`);
      console.log("   ⇒ InsufficientCredit = welcome credits becomeDevTenant < 10000 (catat sbg temuan).");
    }
  }

  banner("Onboarding selesai");
  console.log("operator :", op.did);
  console.log("recipient:", rcpt.did);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
