# TrustDrop — Agen Penyalur Bansos Terverifikasi

> AI agent yang memverifikasi kelayakan dan mencairkan bantuan sosial **atas nama lembaga** — tanpa pernah memegang data pribadi warga (nama, NIK, rekening) — dengan jejak audit yang tak bisa diubah. Dibangun di atas [Terminal 3 Agent Dev Kit](https://docs.terminal3.io).
>
> **Demo live:** [trustdrop26.vercel.app](https://trustdrop26.vercel.app)

---

## Masalah

Penyaluran bantuan sosial menanggung dua beban yang saling bertentangan:

- **Akurasi sasaran** menuntut verifikasi data pribadi warga di banyak titik — operator, dinas, bank penyalur — sehingga rawan bocor.
- **Anti-fraud** menuntut jejak terverifikasi, yang sering tak ada — membuka celah data ganda, penerima fiktif, atau dana yang tak sampai.

## Solusi

TrustDrop memisahkan **kemampuan bertindak** dari **kepemilikan rahasia**. AI agent menyusun & menjalankan pencairan, tetapi PII penerima disegel di dalam **Trusted Execution Environment (TEE)** milik Terminal 3 Network (T3N) — agent tak pernah melihatnya. Saat eksekusi, agent hanya mengirim *instruksi* (tanpa PII); host T3N me-resolve data sensitif **di dalam enclave**, memanggil penyalur, lalu menyaring respons sebelum mengembalikan status.

**Garis batas PII (terbukti di kode):**

| Aktor | Lihat PII? | Alasan |
|---|---|---|
| AI Agent / Operator | ❌ | hanya kirim instruksi, terima `{status, tx_id}` |
| Contract (WASM) | ❌ | hanya menulis marker `{{profile.*}}`; baca map kelayakan bebas-PII |
| TEE Host (enclave) | ✅ (sesaat) | resolve placeholder lalu kirim ke provider; tak pernah ke WASM |
| Payment provider | ✅ | memang butuh nama untuk membayar |
| Audit ledger | ❌ | hanya `recipient_did` + nominal + status |

---

## Cara kerja (alur end-to-end)

```
1. Penerima onboard via OTP email → profil PII {first_name, last_name}
   tersimpan di profil T3N MILIK PENERIMA SENDIRI.            [scripts/onboard-recipient.ts]

2. Penerima tanda tangan grant (Agent Auth) → operator boleh
   panggil execute-disbursement ke host yang diizinkan.       [agent-auth-update]

3. Operator (berkredit) panggil execute-disbursement dengan
   pii_did = penerima. TIDAK mengirim PII — hanya instruksi.  [contract/src/disburse.rs]

4. DI DALAM ENCLAVE: host resolve {{profile.first_name}}
   {{profile.last_name}} → "Budi Santoso", lalu POST ke
   {MOCK_PROVIDER_URL}/api/mock-provider.                     [http-with-placeholders]

5. Provider merekam nama ter-resolve (ke Upstash), membalas
   hanya tx_id (respons tersanitasi, tanpa echo PII).         [app/api/mock-provider]

6. Contract menulis dedup ledger + audit entry (tanpa PII),
   membalas ke operator hanya {status, tx_id}.                [contract/src/disburse.rs]

7. Dashboard menarik ledger & menampilkan kontras:
   sisi provider melihat nama | sisi agent hanya tx_id.       [app/page.tsx]
```

Inilah **"money shot"**: satu transaksi, dua tingkat keterlihatan. Operator memegang **kredit & wewenang**; penerima memegang **PII-nya sendiri**; keduanya tak pernah bertukar PII plaintext.

---

## Arsitektur

```
Operator (lembaga)  ->  AI Agent (di luar TEE)  ->  T3N / TEE contract  ->  Payment provider
   atur policy            orkestrasi, tanpa PII       eksekusi tepercaya       terima PII via placeholder
   setujui run            panggil contract            resolve PII + audit       (mock: Next.js + Upstash)
```

### 1. TEE Contract — Rust → WASM (`contract/`)
Crate Rust yang dikompilasi ke **WASM component** (`wasm32-wasip2`), jalan di dalam enclave T3N. Meng-export **3 fungsi** lewat interface WIT (`contract/wit/world.wit`):

| Fungsi | File | Tugas | PII keluar? |
|---|---|---|---|
| `check-eligibility` | `src/eligibility.rs` | Cek 1 penerima vs policy (region + income bracket) | ❌ |
| `prepare-batch` | `src/batch.rs` | Susun daftar pencairan dalam budget + cek dedup | ❌ |
| `execute-disbursement` | `src/disburse.rs` | Bayar provider via placeholder, tulis dedup + audit | ❌ |

> **Catatan resolusi placeholder:** host T3N me-resolve `{{profile.*}}` hanya dari **satu** subjek yang ter-bind (penerima), dan hanya field KYC kanonik. `bank_account` ditolak (`profile-ref`), `ssn` divalidasi format US — jadi yang di-resolve di demo ini adalah **nama lengkap warga**. Karena itu `execute-disbursement` dipanggil **per-penerima**, masing-masing ter-bind sebagai user context-nya sendiri (`pii_did`).

### 2. Orkestrasi — TypeScript (`scripts/`)
Menggerakkan siklus Agent Auth SDK: onboarding penerima (OTP email), commit profil PII, penandatanganan grant, dan invokasi pencairan. Skrip utama: `scripts/onboard-recipient.ts`.

### 3. Provider tiruan + Dashboard — Next.js (`app/`)
- `app/api/mock-provider/route.ts` — endpoint penyalur. `POST` menerima body ber-PII dari enclave & merekamnya; membalas **respons tersanitasi** (`tx_id` + `status`, tanpa echo PII). `GET` mengembalikan ledger.
- `app/api/mock-provider/store.ts` — persistence: **Upstash Redis** bila env tersedia (wajib di Vercel karena serverless tak berbagi memori), fallback in-memory untuk dev lokal.
- `app/page.tsx` — dashboard yang polling tiap 2.5 dtk dan menampilkan kontras "yang diterima provider" vs "yang dilihat agen".

---

## KV Maps (dibuat sebelum contract berjalan)

| Map (`z:<tid>:<tail>`) | Isi | Dibaca contract? |
|---|---|---|
| `secrets` | API key provider | runtime |
| `eligibility` | `recipient_did`, `region_code`, `income_bracket` + `_index` — **bebas-PII** | ya |
| `policy` | policy aktif (key `current`) | ya |
| `disbursed-<period>` | dedup ledger per periode | baca/tulis |
| `audit` | audit entries (tanpa PII) | tulis |
| *(profil PII penerima)* | `first_name`, `last_name` | **TIDAK** — hanya via placeholder |

---

## Tech stack

- **TEE contract:** Rust + `wit-bindgen` 0.49, target `wasm32-wasip2` (WASM component) — v0.2.3
- **SDK:** `@terminal3/t3n-sdk` (Node ≥ 18, TypeScript)
- **Orkestrasi + frontend:** Next.js 16 (App Router, Turbopack, TypeScript, Tailwind 4)
- **Persistence dashboard:** Upstash Redis (`@upstash/redis`)
- **Reasoning agent (rencana):** Groq `llama-3.3-70b-versatile` — di luar jalur kepercayaan, tak menyentuh PII

---

## Setup

### Prasyarat
1. **Akun & developer key Terminal 3** ([claim page](https://www.terminal3.io/claim-page)). Salin key segera — hanya ditampilkan sekali. DID `did:t3n:...` + test token otomatis ter-link.
2. **Node.js ≥ 18** (disarankan 20 LTS).
3. **Rust toolchain** + target WASM:
   ```bash
   rustup target add wasm32-wasip2
   ```

### Environment (`.env.local`)
```bash
T3N_API_KEY=...            # developer/operator key (akun berkredit)
AGENT_KEY=...              # signing key agent
RECIPIENT_KEY=...          # signing key identitas penerima demo (DID tetap)
GROQ_API_KEY=...           # lapisan agent/LLM (opsional)
DISBURSE_PERIOD=2026-07    # periode pencairan (ubah untuk demo baru)

# Tujuan POST enclave — HARUS base URL app dashboard yang sama (tanpa /api/mock-provider).
# Default ke httpbin.org bila kosong → baris baru TIDAK akan muncul di dashboard.
MOCK_PROVIDER_URL=https://trustdrop26.vercel.app

# Persistence dashboard (wajib di Vercel; opsional lokal). Salah satu pasangan:
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
# atau: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

---

## Menjalankan

```bash
# Build contract → WASM component (contract/target/wasm32-wasip2/release/bansos_contracts.wasm)
npm run contract:build

# Test contract (target native, sebab .cargo/config.toml default ke wasm)
npm run contract:test            # 8/8 tests

# Provisioning: buat KV map, seed secret/policy/eligibility, register contract, grant
npm run provision

# Dashboard + mock provider (lokal)
npm run dev                      # http://localhost:3000
```

### Demo "money shot" (onboarding penerima + pencairan)
Jalankan di terminal interaktif (perlu mengetik kode OTP yang masuk ke email):
```bash
npx tsx --env-file=.env.local scripts/onboard-recipient.ts <email>
```
Tahapannya: auth penerima → (verifikasi OTP bila perlu) → commit profil PII → penerima grant operator → operator cairkan `pii_did=penerima` → **SUCCESS**. Baris baru muncul live di dashboard.

> **Tips demo:** untuk melihat **baris baru**, ganti `DISBURSE_PERIOD` (mis. `2026-08`) atau pakai penerima berbeda — contract men-skip penerima+periode yang sudah dicairkan (`SKIPPED_DUPLICATE`).

---

## Status & disclaimer

Proyek hackathon (*Terminal 3 Agent Dev Kit Bounty Challenge*). Menggunakan **data sintetis** (bukan DTKS/Dukcapil) dan **token sandbox** (bukan uang riil). Dua aturan kelayakan (region + income bracket) disimulasikan. Ini demo kapabilitas SDK, **bukan sistem produksi pemerintah**.

## Lisensi

MIT.
