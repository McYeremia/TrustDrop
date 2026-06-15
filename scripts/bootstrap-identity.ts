/**
 * bootstrap-identity.ts — Cetak identitas T3N baru (atau pakai yang ada) lalu
 * self-admit testnet (`becomeDevTenant`) untuk MEMINTA welcome credits, dan
 * LAPORKAN saldo aktual. Inilah cara mengukur "berapa credit per DID" supaya
 * kita tahu berapa DID yang dibutuhkan untuk 1 test + 1 demo.
 *
 * KENDALA (tipe SDK index.d.ts:568-594): `submitUserInput` butuh `profile` DAN
 * email terverifikasi (gate EmailNotVerified). Welcome credits cuma di-mint saat
 * tenantAdmit.status="admitted". Jadi TIAP identitas baru butuh 1 email berbeda
 * (pakai trik gmail "+": you+op@gmail.com, you+agent@gmail.com, you+r1@…).
 *
 * Jalankan (di terminal Anda agar bisa mengetik kode OTP):
 *   npx tsx --env-file=.env.local scripts/bootstrap-identity.ts <label> <email> [existing_secret]
 *
 *   <label>          : penanda peran utk log + nama env yg disarankan (operator|agent|r1|…)
 *   <email>          : email penerima OTP (harus unik per identitas)
 *   [existing_secret]: opsional — kalau diisi, pakai key itu (cek/isi-ulang DID lama)
 *                      ; kalau kosong, GENERATE keypair baru dan cetak secret-nya.
 *
 * Output penting: SECRET (simpan ke .env.local), DID, grantedCredits, saldo.
 */

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  T3nClient, setEnvironment, loadWasmComponent,
  eth_get_address, metamask_sign, createEthAuthInput,
} from "@terminal3/t3n-sdk";

// Profil minimal NON-PII (cukup utk lolos commit; bukan data warga sungguhan).
// bank_account ditolak profil, ssn divalidasi 9-digit US (Temuan #T2-9) → nama saja.
const BOOTSTRAP_PROFILE = { first_name: "TrustDrop", last_name: "DevTenant" };

function banner(s: string) { console.log(`\n${"─".repeat(60)}\n${s}\n${"─".repeat(60)}`); }

/** Eth private key = 32 byte acak, hex 0x-prefixed (konvensi standar). */
function generateSecret(): string {
  return "0x" + randomBytes(32).toString("hex");
}

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
  try {
    const usage = await client.getUsage();
    return usage.balance?.available ?? null;
  } catch (e) {
    console.log(`   (gagal baca saldo) ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function main() {
  const label = process.argv[2];
  const email = process.argv[3];
  const providedSecret = process.argv[4];
  if (!label || !email) {
    console.error("Pakai: bootstrap-identity.ts <label> <email> [existing_secret]");
    process.exit(1);
  }

  setEnvironment("testnet");

  // ── 1. Identitas: generate baru atau pakai yang diberikan ──
  banner(`1 — Identitas (${label})`);
  const isNew = !providedSecret;
  const secret = providedSecret ?? generateSecret();
  if (isNew) {
    console.log("   🆕 keypair BARU di-generate. SIMPAN secret di bawah ke .env.local:");
    console.log(`\n   ${label.toUpperCase()}_KEY=${secret}\n`);
  } else {
    console.log("   ♻️  memakai existing_secret yang diberikan.");
  }
  const me = await authClient(label, secret);
  console.log(`   address: ${me.address}`);
  console.log(`   did    : ${me.did}`);

  const before = await readBalance(me.client);
  console.log(`   saldo (sebelum): ${before ?? "?"}`);

  // ── 2. Coba self-admit langsung (email mungkin sudah terverifikasi) ──
  const submit = () =>
    me.client.submitUserInput({ profile: BOOTSTRAP_PROFILE, becomeDevTenant: true });

  banner("2 — submitUserInput(becomeDevTenant) — coba langsung");
  let res;
  try {
    res = await submit();
    console.log("   ✅ commit (email sudah terverifikasi)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/email.?not.?verified|EmailNotVerified|verified email/i.test(msg)) {
      console.log(`   ❌ submitUserInput: ${msg}`);
      process.exit(1);
    }
    console.log("   ℹ️ email belum terverifikasi → jalankan OTP sekali.");

    // ── 2b. OTP (sesi SAMA — state OTP terikat sesi) ──
    banner("2b — OTP");
    const reqRes = await me.client.otpRequest({ emailChannel: { emailAddress: email } });
    console.log("   ✅ OTP dikirim:", JSON.stringify(reqRes));
    const rl = createInterface({ input, output });
    const code = (await rl.question(`   Kode OTP utk ${email}: `)).trim();
    rl.close();
    const v = await me.client.otpVerify({ otpCode: code, request: { emailChannel: { emailAddress: email } } });
    if (v.status) { console.log("   ❌ otpVerify status:", v.status, "(kode salah/kedaluwarsa)"); process.exit(1); }
    console.log("   ✅ otpVerify OK");

    banner("3 — submitUserInput(becomeDevTenant) — setelah verify");
    res = await submit();
    console.log("   ✅ commit");
  }

  // ── 4. Hasil self-admit + saldo ──
  banner("4 — Hasil welcome credits");
  if (res.tenantAdmit) {
    console.log("   tenantAdmit:", JSON.stringify(res.tenantAdmit));
    if (res.tenantAdmit.status === "refused")
      console.log(`   ⚠️ self-admit DITOLAK (reason=${res.tenantAdmit.reason}) → tidak ada credit.`);
    else
      console.log(`   grantedCredits: ${res.tenantAdmit.grantedCredits ?? "(tidak dilaporkan)"}`);
  } else {
    console.log("   ⚠️ tidak ada field tenantAdmit (becomeDevTenant tak diproses?).");
  }
  const after = await readBalance(me.client);
  console.log(`   saldo (sesudah): ${after ?? "?"}`);
  if (before != null && after != null) console.log(`   Δ saldo: ${after - before}`);

  // ── Ringkasan ──
  banner("Ringkasan — simpan ini");
  if (isNew) console.log(`${label.toUpperCase()}_KEY=${secret}`);
  console.log(`did    : ${me.did}`);
  console.log(`saldo  : ${after ?? "?"} credits`);
  console.log("\nLangkah berikut: jalankan untuk identitas lain dgn email berbeda,");
  console.log("lalu kita hitung berapa DID cukup untuk 1 test + 1 demo dari Δ saldo di atas.");
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
