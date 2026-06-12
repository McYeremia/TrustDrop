# Agen Penyalur Bansos Terverifikasi

> AI agent yang memverifikasi kelayakan dan mencairkan bantuan sosial atas nama lembaga — **tanpa pernah memegang data pribadi warga atau kredensial keuangan** — dengan jejak audit yang tak bisa diubah. Dibangun di atas [Terminal 3 Agent Dev Kit](https://docs.terminal3.io).

---

## Masalah

Penyaluran bantuan sosial menanggung dua beban yang saling bertentangan:

- **Akurasi sasaran** menuntut verifikasi data pribadi warga (penghasilan, domisili, status keluarga) di banyak titik — operator, dinas, bank penyalur — sehingga rawan bocor dan disalahgunakan.
- **Anti-fraud** menuntut jejak terverifikasi, yang sering tak ada — membuka celah data ganda, penerima fiktif, atau dana yang tak benar-benar sampai.

## Solusi

Sistem ini memisahkan **kemampuan bertindak** dari **kepemilikan rahasia**. Sebuah AI agent menyusun dan menjalankan pencairan, tetapi PII penerima dan kredensial penyalur disegel di dalam Trusted Execution Environment (TEE) milik Terminal 3 Network — agent tak pernah melihatnya. Setiap verifikasi dan pencairan dicatat ke audit ledger yang dapat diperiksa publik **tanpa membongkar identitas penerima**.

Saat eksekusi, agent hanya mengirim *instruksi* (tanpa PII). T3N me-resolve data sensitif di dalam enclave, memanggil penyalur, lalu menyaring respons sebelum mengembalikan status — sehingga data finansial tak pernah terekspos ke agent.

## Fitur utama

- **Identitas terverifikasi (DID)** untuk agent dan lembaga.
- **Delegasi terikat policy** — lembaga menandatangani grant yang membatasi agent ke fungsi & host tertentu.
- **Selective disclosure** — kelayakan diverifikasi lewat klaim/VC tanpa membuka nilai mentah data warga.
- **Pencairan tanpa PII di agent** — data bank di-resolve di enclave via placeholder.
- **Compliance gate** — tolak pencairan ganda atau di luar policy (kriteria, nominal, anggaran, periode).
- **Audit ledger publik** — buktikan tiap pencairan sesuai scope tanpa mengungkap PII.

## Arsitektur singkat

```
Operator (lembaga)  ->  AI Agent (di luar TEE)  ->  T3N / TEE contract  ->  Payment provider (sandbox)
   atur policy            orkestrasi, tanpa PII       eksekusi tepercaya       terima PII via placeholder
   setujui run            panggil contract            simpan PII + audit ledger
```

AI agent dan LLM berada **di luar** TEE dan tak pernah menyentuh PII; mereka hanya merencanakan dan memanggil fungsi contract.

## Tech stack

- **TEE contract:** Rust + `wit-bindgen`, target `wasm32-wasip2` (WASM component)
- **SDK:** `@terminal3/t3n-sdk` (Node ≥ 18, TypeScript)
- **Orkestrasi + frontend:** Next.js 16 (App Router, TypeScript, Tailwind)
- **Reasoning agent:** Groq `llama-3.3-70b-versatile`
- **Provider tiruan:** Next.js API route (mock disbursement endpoint)

---

## Prasyarat

1. **Akun & token Terminal 3.** Buka [claim page](https://www.terminal3.io/claim-page), sign in dengan email kerja, masukkan campaign code hackathon jika ada. **Salin developer key segera** — hanya ditampilkan sekali. DID `did:t3n:...` dan test token otomatis ter-link.
2. **Node.js ≥ 18** (disarankan 20 LTS).
3. **Rust toolchain** (rustup).

## Setup & instalasi

```bash
# 1. Toolchain Rust + WASM
rustup target add wasm32-wasip2
cargo install wasm-tools            # opsional, untuk inspeksi component

# 2. Buat app Next.js
npx create-next-app@latest bansos-agent   # TypeScript, App Router, Tailwind
cd bansos-agent

# 3. Dependencies
npm install @terminal3/t3n-sdk      # SDK inti (Node >= 18)
npm install groq-sdk                # lapisan agent/LLM

# 4. Repo contoh contract (referensi untuk fork)
git clone https://github.com/Terminal-3/z-tenant-flight
```

Buat `.env.local`:

```bash
T3N_API_KEY=your_developer_key_from_claim_page
AGENT_KEY=your_agent_signing_key
GROQ_API_KEY=your_groq_key
```

## Struktur proyek (rencana)

```
bansos-agent/
├─ contract/                 # TEE contract Rust (fork z-tenant-flight)
│  ├─ src/
│  │  ├─ lib.rs              # entry wit-bindgen + dispatch ke tiap fungsi
│  │  ├─ eligibility.rs      # check-eligibility (no PII)
│  │  ├─ batch.rs            # prepare-batch (no PII, anti-dobel)
│  │  └─ disburse.rs         # execute-disbursement (PII via placeholder)
│  ├─ wit/
│  │  ├─ world.wit           # export contracts + import host interfaces
│  │  └─ deps/               # host-interfaces, host-tenant (vendored)
│  └─ Cargo.toml
├─ src/
│  ├─ app/                   # dashboard operator + public audit viewer
│  └─ lib/
│     ├─ t3n/                # setup client, register, grant, invoke
│     └─ agent/              # orkestrasi + Groq
├─ scripts/
│  └─ provision.ts           # buat map, seed secret, register, grant
├─ mock-provider/            # endpoint penyalur tiruan
└─ data/                     # dataset penerima dummy
```

## Menjalankan

```bash
# Build contract -> WASM component
cd contract && cargo build --target wasm32-wasip2 --release
cd ..

# Provisioning: buat KV map, seed secret, register contract, tandatangani grant
npm run provision

# Jalankan app + mock provider
npm run dev
```

## Alur demo

1. Operator mengatur policy (kriteria kelayakan, nominal, anggaran, periode) di dashboard.
2. Operator memicu run; agent menyusun daftar penerima lewat `check-eligibility` + `prepare-batch`.
3. Operator menyetujui (human-in-the-loop).
4. Agent menjalankan `execute-disbursement`; **mock provider menerima detail rekening yang ter-resolve, sementara agent tak pernah melihatnya** — inilah inti demo.
5. Public audit viewer menampilkan bukti tiap pencairan sesuai scope, tanpa PII.

## Privasi & keamanan

PII penerima dan kredensial penyalur **tidak pernah masuk ke memori agent maupun LLM**. Data sensitif hanya di-resolve di dalam enclave T3N saat panggilan keluar, lewat mekanisme placeholder. Audit ledger menampilkan DID + nominal + status kepatuhan, bukan nama/rekening.

## Status & disclaimer

Proyek hackathon. Menggunakan **data dummy** (bukan DTKS/Dukcapil) dan **token sandbox** (bukan uang riil). Aturan kelayakan disimulasikan. Bukan sistem produksi pemerintah.

## Lisensi

MIT (atau sesuaikan).
