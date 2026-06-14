# TrustDrop — Agen Penyalur Bansos Terverifikasi

> AI agent yang memverifikasi kelayakan dan mencairkan bantuan sosial **atas nama lembaga** — tanpa pernah memegang data pribadi warga (nama, NIK, rekening) — dengan jejak audit yang tak bisa diubah. Dibangun di atas [Terminal 3 Agent Dev Kit](https://docs.terminal3.io).
>
> **Demo live:** [trustdrop26.vercel.app](https://trustdrop26.vercel.app) · **Console:** [/app](https://trustdrop26.vercel.app/app)

---

## Tesis

> **Operator hanya boleh berkata "ya, dia layak" — bukan "berapa" dan bukan "siapa namanya".**
> Nominal ditentukan aturan (contract), identitas dijaga enclave (TEE), kelayakan dibuktikan tanda tangan issuer (bukan deklarasi).

Dua kekuasaan yang paling sering disalahgunakan dipindahkan dari operator:

1. **Menentukan nominal** → pindah ke contract (tabel golongan). Operator tak pernah mengetik angka.
2. **Melihat / memegang PII** → tetap di enclave. Operator & agent tak pernah melihat data mentah.

Yang tersisa di tangan operator: **satu wewenang akuntabel** — approve/reject kelayakan, dan setiap keputusan tercatat di audit.

## Masalah yang diangkat

Terinspirasi dari masalah nyata di Indonesia, di mana bansos kadang tidak sampai ke penerima yang berhak. TrustDrop mematikan tiga celah sekaligus, **by design**:

- **SKTM palsu** (orang kaya dapat bantuan) → atestasi penghasilan datang dari issuer otoritatif (kantor pajak); tanda tangan kriptografis tak bisa dipalsukan.
- **Penerima fiktif / ganda** → 1 identitas = 1 klaim per periode (dedup di contract).
- **Penyunatan nominal** → operator tak menentukan jumlah; contract yang menetapkan dari golongan.

---

## Model kepercayaan (separation of duties)

| Aktor | Boleh | Dilarang |
|---|---|---|
| **Penerima** | onboard, **mengajukan** diri + lampirkan atestasi, lihat status & dana diterima | — |
| **Issuer** (Pajak, Dukcapil) | menandatangani klaim atribut dari ground-truth-nya | menyalurkan dana |
| **Operator** | **approve/reject** kelayakan; memicu pencairan | menentukan nominal · melihat PII · mengalihkan dana |
| **Contract (TEE)** | menetapkan golongan→nominal, resolve PII di enclave, menulis audit | — |

**Kenapa aman walau issuer melihat data:** issuer sudah sah memiliki data itu (pajak tahu penghasilan, Dukcapil tahu domisili) — tak ada PII baru bocor. Issuer tidak menyalurkan dana, dan yang menyeberang antar-domain hanya **klaim minimal bertanda tangan** (`income=low`), bukan angka mentah. Tak ada satu pihak pun yang menggenggam semua data.

## Alur end-to-end

```
1. AJUAN      Penerima buktikan identitas (NIK) → issuer tanda tangani atribut
              SEBENARNYA (income✍️Pajak, region+household✍️Dukcapil). Tanpa upload file.
2. PREVIEW    Tanda tangan diverifikasi instan → "tampak layak: G1 Rp700k" atau "tidak layak".
3. APPROVAL   Operator lihat antrian: badge atribut ter-atestasi (TANPA PII, TANPA nama)
              → APPROVE → record kelayakan ditulis ke KV `eligibility` (LIVE) + audit.
4. PENENTUAN  check-eligibility (LIVE) → contract menetapkan golongan & nominal.
              prepare-batch (LIVE) → daftar disetujui + total dalam budget.
5. PENYALURAN disburse → enclave resolve nama → provider mencatat. Agent hanya lihat tx_id.
6. PENERIMAAN Penerima lihat "Bantuan {Golongan}: Rp ___ diterima" (tampilan; bukan uang nyata).
```

## Golongan (tier) — nominal ditetapkan contract

| Golongan | Syarat | Nominal |
|---|---|---|
| **G1 — Prioritas** | `income=low` & household ∈ {elderly, disabled, single_parent} | Rp 700.000 |
| **G2 — Reguler** | `income=low` & household ∈ {head_of_family, married} | Rp 600.000 |
| **G3 — Menengah** | `income=medium` | Rp 400.000 |
| *(Tidak layak)* | `income=high`, atau region di luar cakupan, atau belum ter-atestasi | — |

---

## Arsitektur

```
Penerima ─┐                         ┌─ Issuer sandbox (ed25519, ground-truth)
          ├─ Next.js (UI + API) ────┤
Operator ─┘   /app: 3 konsol        └─ T3N / TEE contract  ─→  Mock provider (Upstash)
                                        (eligibility, tiers,       (ledger + receipt)
                                         audit; resolve PII)
```

### 1. TEE Contract — Rust → WASM (`contract/`) — v0.3.0
WASM component (`wasm32-wasip2`) di enclave T3N. Tiga fungsi WIT:

| Fungsi | File | Tugas |
|---|---|---|
| `check-eligibility` | `src/eligibility.rs` | wajib `attested`; tetapkan golongan & nominal; kembalikan `{eligible, reason_code, tier, amount}` |
| `prepare-batch` | `src/batch.rs` | scan eligibility, nominal dari golongan, cek dedup + budget |
| `execute-disbursement` | `src/disburse.rs` | bayar provider via placeholder (nama di-resolve di enclave) |

Nominal **dihitung dari aturan tier di contract** (`assign_tier`), bukan dari input operator.

### 2. Issuer attestation (`lib/issuer/`, `lib/eligibility/`)
- `issuer.ts` — tanda tangan/verifikasi ed25519 (`@noble/ed25519`), key dari seed deterministik.
- `registry.ts` — dataset ground-truth campuran (`data/issuer-registry.json`); issuer menandatangani **nilai sebenarnya** → orang kaya tetap `high` → ditolak.
- `tiers.ts` — cermin aturan tier contract di TS untuk preview instan + verifikasi policy.

### 3. Backend API routes (`app/api/`)
| Route | Fungsi | Mode |
|---|---|---|
| `POST /api/issuer/attest` | issuer tanda tangani klaim dari ground-truth | simulasi |
| `POST /api/recipient/apply` | verifikasi tanda tangan + simpan pending | app |
| `GET /api/operator/applications` | antrian pengajuan (tanpa PII) | app |
| `POST /api/operator/decision` | approve → seed `eligibility` + audit | **LIVE** |
| `POST /api/contract/check-eligibility` | verifikasi kelayakan + golongan | **LIVE** |
| `POST /api/contract/prepare-batch` | susun batch + nominal dari golongan | **LIVE** |
| `POST /api/contract/disburse` | resolve nama server-side → mock provider | mock |
| `GET /api/audit` | log keputusan + pencairan (tanpa PII) | app |
| `GET /api/mock-provider` | ledger pencairan (dashboard + receipt) | existing |

### 4. Frontend (`app/`)
- **`/` Landing** (hero dipertahankan): section fitur — tesis, 3 fraud yang mati, how-it-works, statistik live, kontras money-shot, ledger.
- **`/app` Console** — pemilih peran:
  - **Recipient**: input NIK → kartu sertifikat atestasi + preview kelayakan → Apply.
  - **Operator**: antrian + badge atribut ter-atestasi → Approve/Reject → Check eligibility / Prepare batch / Disburse (tanpa PII).
  - **Auditor**: ledger publik (keputusan + pencairan), tanpa PII.

---

## Tech stack

- **TEE contract:** Rust + `wit-bindgen`, target `wasm32-wasip2` — v0.3.0
- **Atestasi:** `@noble/ed25519` (signing) + Web Crypto SHA-512 (key derivation)
- **SDK:** `@terminal3/t3n-sdk` (Node ≥ 18)
- **Frontend + API:** Next.js 16 (App Router, Turbopack, TS, Tailwind 4)
- **Persistence:** Upstash Redis (`@upstash/redis`)
- **Tes:** Vitest (logika TS), `cargo test` (contract)

---

## Setup

### Prasyarat
1. **Developer key Terminal 3** ([claim page](https://www.terminal3.io/claim-page)).
2. **Node.js ≥ 18**, **Rust** + `rustup target add wasm32-wasip2`.

### Environment (`.env.local`)
```bash
T3N_API_KEY=...            # operator key (akun berkredit) — wajib utk route live
AGENT_KEY=...              # signing key agent
RECIPIENT_KEY=...          # identitas penerima demo (onboard-recipient.ts)
GROQ_API_KEY=...           # opsional (lapisan agent/LLM)
DISBURSE_PERIOD=2026-07

# Tujuan POST enclave — base URL app dashboard yang sama (tanpa /api/mock-provider)
MOCK_PROVIDER_URL=https://trustdrop26.vercel.app

# Issuer sandbox (opsional; default dev seed dipakai bila kosong)
ISSUER_TAX_SEED=...
ISSUER_CIVIL_SEED=...

# Persistence (wajib di Vercel; opsional lokal) — salah satu pasangan:
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
# atau UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

---

## Menjalankan

```bash
# Contract → WASM + test
npm run contract:build
cargo test --lib --target x86_64-pc-windows-msvc   # 12/12 (di folder contract)

# Tes logika TS (issuer, tier)
npm test                          # vitest, 12/12

# Provisioning testnet: register contract v0.3.0, seed policy tiers, eligibility kosong
npx tsx --env-file=.env.local scripts/provision.ts

# Dashboard + console
npm run dev                       # http://localhost:3000  ·  /app
```

### Alur demo (UI)
1. **`/app` → Recipient**: pilih NIK contoh (`…0006` low/elderly → G1; `9999…0001` high → ditolak) → Request attestation → Apply.
2. **Operator**: lihat antrian → Approve → Check eligibility (live) → Prepare batch (live) → Disburse.
3. **Auditor**: lihat keputusan + pencairan (tanpa PII). Money-shot di landing menunjukkan nama hanya di sisi provider.

> **Tip:** ganti `DISBURSE_PERIOD` atau penerima untuk melihat baris baru — dedup men-skip penerima+periode yang sudah dicairkan.

### Jalur enclave sungguhan (opsional)
`scripts/onboard-recipient.ts` menjalankan `execute-disbursement` nyata (OTP + grant + placeholder resolve di enclave):
```bash
npx tsx --env-file=.env.local scripts/onboard-recipient.ts <email>
```

---

## Privasi & yang disimulasikan

PII penerima tak pernah masuk memori agent, contract, maupun browser operator. Issuer (Pajak/Dukcapil) = keypair sandbox + dataset sintetis; tidak memakai DTKS/Dukcapil asli; disbursement memukul mock provider, bukan bank nyata; dana = angka tampilan. Verifikasi tanda tangan ada di lapisan app (Fase 1); memindahkannya ke enclave adalah hardening Fase 2.

## Status & disclaimer

Proyek hackathon (*Terminal 3 Agent Dev Kit Bounty Challenge*). Data sintetis, token sandbox. Aturan kelayakan disimulasikan. **Bukan sistem produksi pemerintah.**

## Dokumentasi desain

- Spec: `docs/superpowers/specs/2026-06-14-trustdrop-eligibility-disbursement-design.md`
- Plan: `docs/superpowers/plans/2026-06-14-trustdrop-eligibility-disbursement.md`

## Lisensi

MIT.
