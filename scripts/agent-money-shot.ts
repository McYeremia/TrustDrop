/**
 * agent-money-shot.ts — Money shot INTI bounty: AGENT (DID-nya sendiri) yang
 * benar-benar mengeksekusi `execute-disbursement` di kontrak LIVE (v0.4.0,
 * contractId=153) di bawah wewenang yang DIDELEGASIKAN penerima — tanpa pernah
 * melihat PII. Host me-resolve nama penerima di dalam enclave; kontrak menghitung
 * ulang kelayakan + amount (anti-bypass). Sekaligus MENGUKUR biaya agent per call.
 *
 * Beda dgn onboard-recipient.ts (yg memakai OPERATOR sbg pemanggil): di sini
 * PEMANGGIL = AGENT. Itu inti Agent Auth SDK yang dinilai juri.
 *
 * Rantai per penerima:
 *   1. Penerima: generate key → OTP verify → submitUserInput(profil nama,
 *      becomeDevTenant) → 20000 credits + profil PII (first/last name) commit.
 *   2. Operator: tulis record eligibility (PII-FREE, attested:true) ke map `eligibility`.
 *   3. Penerima: agent-auth-update → GRANT ke AGENT (execute-disbursement + allowedHosts).
 *   4. AGENT: executeAndDecode execute-disbursement (pii_did=penerima, program_id).
 *      Kontrak resolve {{profile.first_name}} {{profile.last_name}} di enclave,
 *      kirim ke provider, balikkan hanya status+tx_id (tersanitasi).
 *
 * Jalankan (interaktif — Anda mengetik kode OTP tiap penerima):
 *   npx tsx --env-file=.env.local scripts/agent-money-shot.ts <email_r1> <email_r2>
 *
 * Prasyarat .env.local: T3N_API_KEY (operator berkredit), AGENT_KEY (agent berkredit).
 */

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  T3nClient, TenantClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const T3N_API_KEY = process.env.T3N_API_KEY;
const AGENT_KEY = process.env.AGENT_KEY;
const CONTRACT_TAIL = "bansos-contracts";
const PERIOD = process.env.DISBURSE_PERIOD ?? "2026-07"; // dedup map disbursed-<program>-<period> harus sudah ada (provision)
const PROVIDER_URL = process.env.MOCK_PROVIDER_URL ?? "https://httpbin.org/anything";
const ALLOWED_HOSTS = [new URL(PROVIDER_URL).hostname]; // hostname MURNI (Temuan #T2-6)

/**
 * Profil + atribut kelayakan tiap penerima demo. Atribut (region/income/household)
 * = fakta yang "ditandatangani issuer" (attested:true), DIPISAH dari PII (nama).
 * Dipetakan ke satu program yang pasti lolos:
 *   r1 → jkt-cash-2026 (JKT, low; tier G2 = 600000)
 *   r2 → bdg-food-2026 (BDG, low; flat = 500000)
 */
const RECIPIENTS = [
  { label: "r1", first_name: "Budi",  last_name: "Santoso", region_code: "JKT", income_bracket: "low", household_status: "head_of_family", program_id: "jkt-cash-2026" },
  { label: "r2", first_name: "Siti",  last_name: "Aminah",  region_code: "BDG", income_bracket: "low", household_status: "head_of_family", program_id: "bdg-food-2026" },
];

function banner(s: string) { console.log(`\n${"─".repeat(64)}\n${s}\n${"─".repeat(64)}`); }
function genSecret() { return "0x" + randomBytes(32).toString("hex"); }

async function authClient(label: string, secret: string) {
  const address = eth_get_address(secret);
  const client = new T3nClient({
    wasmComponent: await loadWasmComponent(),
    handlers: { EthSign: metamask_sign(address, undefined, secret) },
  });
  await client.handshake();
  const did = (await client.authenticate(createEthAuthInput(address))).value;
  return { client, did, address };
}

async function readBalance(client: T3nClient): Promise<number | null> {
  try { return (await client.getUsage()).balance?.available ?? null; }
  catch { return null; }
}

/** Commit profil + becomeDevTenant, jalankan OTP hanya bila email belum terverifikasi. */
async function onboardRecipient(client: T3nClient, email: string, profile: { first_name: string; last_name: string }) {
  const submit = () => client.submitUserInput({ profile, becomeDevTenant: true });
  try {
    const r = await submit();
    console.log("   ✅ profil commit (email sudah terverifikasi)", r.tenantAdmit ? JSON.stringify(r.tenantAdmit) : "");
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/email.?not.?verified|EmailNotVerified|verified email/i.test(msg)) throw e;
  }
  const reqRes = await client.otpRequest({ emailChannel: { emailAddress: email } });
  console.log("   ✅ OTP dikirim:", JSON.stringify(reqRes));
  const rl = createInterface({ input, output });
  const code = (await rl.question(`   Kode OTP utk ${email}: `)).trim();
  rl.close();
  const v = await client.otpVerify({ otpCode: code, request: { emailChannel: { emailAddress: email } } });
  if (v.status) throw new Error(`otpVerify status=${v.status} (kode salah/kedaluwarsa)`);
  const r = await submit();
  console.log("   ✅ profil commit", r.tenantAdmit ? JSON.stringify(r.tenantAdmit) : "");
}

async function main() {
  if (!T3N_API_KEY) { console.error("❌ T3N_API_KEY kosong"); process.exit(1); }
  if (!AGENT_KEY) { console.error("❌ AGENT_KEY kosong"); process.exit(1); }
  const emails = process.argv.slice(2);
  if (emails.length !== RECIPIENTS.length) {
    console.error(`Pakai: agent-money-shot.ts ${RECIPIENTS.map((r) => `<email_${r.label}>`).join(" ")}`);
    process.exit(1);
  }

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();

  // ── Auth operator + agent ──
  banner("0 — Auth operator + agent");
  const op = await authClient("operator", T3N_API_KEY);
  const agent = await authClient("agent", AGENT_KEY);
  console.log("   operator:", op.did);
  console.log("   agent   :", agent.did);
  const tenantId = op.did.slice("did:t3n:".length);
  const TENANT_SCRIPT = `z:${tenantId}:${CONTRACT_TAIL}`;
  const tenantScriptVer = await getScriptVersion(nodeUrl, TENANT_SCRIPT);
  const userScriptVer = await getScriptVersion(nodeUrl, "tee:user/contracts");
  console.log("   script  :", TENANT_SCRIPT, "v" + tenantScriptVer);
  const opTenant = new TenantClient({ t3n: op.client, baseUrl: nodeUrl, tenantDid: op.did });

  const agentBalStart = await readBalance(agent.client);
  console.log(`   💰 saldo agent (awal): ${agentBalStart ?? "?"}`);

  const summary: Array<{ label: string; did: string; key: string; program: string; status: string; tx_id: string; eligible: boolean }> = [];

  for (let i = 0; i < RECIPIENTS.length; i++) {
    const r = RECIPIENTS[i];
    const email = emails[i];
    banner(`Penerima ${r.label} — ${r.first_name} ${r.last_name} (${email}) → ${r.program_id}`);

    // 1. Identitas penerima + profil + welcome credits
    const secret = genSecret();
    console.log(`   🆕 ${r.label.toUpperCase()}_KEY=${secret}`);
    const rcpt = await authClient(r.label, secret);
    console.log("   did:", rcpt.did);
    await onboardRecipient(rcpt.client, email, { first_name: r.first_name, last_name: r.last_name });

    // 2. Operator tulis record eligibility (PII-FREE, attested oleh issuer)
    await opTenant.executeControl("map-entry-set", {
      map_name: opTenant.canonicalName("eligibility"),
      key: rcpt.did,
      value: JSON.stringify({
        recipient_did: rcpt.did,
        region_code: r.region_code,
        income_bracket: r.income_bracket,
        household_status: r.household_status,
        attested: true,
      }),
    });
    console.log("   ✅ eligibility record (no-PII, attested) ditulis operator");

    // 3. Penerima GRANT ke AGENT (delegasi: agent boleh bertindak utk penerima)
    await rcpt.client.execute({
      script_name: "tee:user/contracts", script_version: userScriptVer,
      function_name: "agent-auth-update",
      input: { agents: [{ agentDid: agent.did, scripts: [{
        scriptName: TENANT_SCRIPT, versionReq: tenantScriptVer,
        functions: ["execute-disbursement"], allowedHosts: ALLOWED_HOSTS,
      }] }] },
    });
    console.log(`   ✅ grant penerima→AGENT (${agent.did.slice(0, 20)}…) OK`);

    // 4. AGENT mengeksekusi (pii_did=penerima). Kontrak resolve nama di enclave.
    let status = "ERROR", tx_id = "", eligible = false;
    try {
      const res = await agent.client.executeAndDecode<{
        results: Array<{ recipient_did: string; status: string; tx_id: string }>;
        success_count: number; fail_count: number;
      }>({
        script_name: TENANT_SCRIPT, script_version: tenantScriptVer,
        function_name: "execute-disbursement", pii_did: rcpt.did,
        input: {
          period: PERIOD, program_id: r.program_id, provider_url: PROVIDER_URL,
          approved: [{ recipient_did: rcpt.did }],
        },
      });
      const row = res.results?.[0];
      status = row?.status ?? "NO_RESULT";
      tx_id = row?.tx_id ?? "";
      eligible = (res.success_count ?? 0) > 0;
      console.log(`   🎯 AGENT execute-disbursement → ${JSON.stringify(res)}`);
      if (eligible) console.log(`   ✅ MONEY SHOT (agent): "${r.first_name} ${r.last_name}" ter-resolve di enclave, agen tak melihatnya.`);
    } catch (e) {
      status = "ERROR";
      console.log(`   ❌ execute-disbursement (agent): ${e instanceof Error ? e.message : String(e)}`);
    }

    summary.push({ label: r.label, did: rcpt.did, key: secret, program: r.program_id, status, tx_id, eligible });
  }

  // ── Biaya agent ──
  const agentBalEnd = await readBalance(agent.client);
  banner("Ringkasan");
  console.log(`agent: ${agent.did}`);
  console.log(`💰 saldo agent: ${agentBalStart ?? "?"} → ${agentBalEnd ?? "?"}`);
  if (agentBalStart != null && agentBalEnd != null) {
    const spent = agentBalStart - agentBalEnd;
    console.log(`💸 biaya ${RECIPIENTS.length}× execute-disbursement: ${spent} credits (≈ ${Math.round(spent / RECIPIENTS.length)}/call)`);
  }
  console.log("\nPenerima (SIMPAN keys jika ingin reuse):");
  for (const s of summary)
    console.log(`  ${s.label}: ${s.status}  tx=${s.tx_id || "-"}  did=${s.did}\n     ${s.label.toUpperCase()}_KEY=${s.key}`);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
