# TrustDrop — Verifiable, Privacy-Preserving Social-Aid Disbursement Agent

> An AI agent that verifies eligibility and disburses social aid **on behalf of an institution** — without ever holding a citizen's personal data (name, national ID, bank account) — backed by an immutable audit trail. Built on the [Terminal 3 Agent Dev Kit](https://docs.terminal3.io).
>
> **Live demo:** [trustdrop26.vercel.app](https://trustdrop26.vercel.app) · **Console:** [/app](https://trustdrop26.vercel.app/app)

---

## Thesis

> **The operator may only say "yes, they qualify" — never "how much" and never "what is their name".**
> The amount is decided by rules (the contract), identity is guarded by the enclave (TEE), and eligibility is proven by an issuer's signature (not a self-declaration).

The two powers most often abused are taken away from the operator:

1. **Setting the amount** → moved to the contract (a tier/benefit table). The operator never types a number.
2. **Seeing or holding PII** → stays inside the enclave. Neither operator nor agent ever sees raw data.

What remains in the operator's hands is **a single accountable authority** — approve/reject eligibility — and every decision is written to the audit log.

---

## Live proof (T3N testnet)

The **agent-driven** money shot runs for real on testnet. The agent (using its own DID) executes `execute-disbursement` on the TEE contract under authority **delegated by the recipient**; the citizen's name is resolved **inside the enclave**, and the agent never sees it.

| | Value |
|---|---|
| Contract (live) | `z:b6ce0233…:bansos-contracts` **v0.4.0**, contractId **153** (multi-program + in-enclave eligibility re-verification) |
| Operator DID | `did:t3n:b6ce0233a4da0ee3ab7f41b8423475fa6e93826f` |
| Agent DID | `did:t3n:699d43e5472b2de992d060bcdc2be6f3513512df` (separate identity; never holds keys or PII) |
| Agent disbursements | `r1` → `jkt-cash-2026` G2 Rp 600k → **SUCCESS** `tx=TX-…-E62LQ4` · `r2` → `bdg-food-2026` FLAT Rp 500k → **SUCCESS** `tx=TX-…-0J3NP9` |
| Measured cost | operator provisioning **3,573** credits · `execute-disbursement` **≈201** credits/call |

**Reproduce** (requires credited `T3N_API_KEY` + `AGENT_KEY` in `.env.local`):

```bash
# Agent-driven money shot: onboard 2 recipients, agent disburses, measure cost
npx tsx --env-file=.env.local scripts/agent-money-shot.ts <email_r1> <email_r2>
```

In the **operator console** (`/app`): click **⚡ Load live demo recipients** → **Disburse** → rows labelled `live TEE · contract 153` carry a real `tx_id`. Recipients without a T3N identity automatically fall back to the hybrid path (`system match`).

---

## The problem

Inspired by a real-world failure mode in Indonesia, where social aid sometimes never reaches the people entitled to it. TrustDrop closes three gaps at once, **by design**:

- **Forged poverty certificates** (wealthy people receiving aid) → income attestations come from an authoritative issuer (the tax office); cryptographic signatures cannot be forged.
- **Ghost or duplicate recipients** → one identity = one claim per program per period (dedup enforced inside the contract).
- **Skimming the amount** → the operator does not set the amount; the contract derives it from program rules.

---

## Trust model (separation of duties)

| Actor | May | May not |
|---|---|---|
| **Recipient** | onboard, **apply** and attach attestations, see status and aid received | — |
| **Issuer** (Tax, Civil Registry) | sign attribute claims from its own ground truth | disburse funds |
| **Operator** | **approve/reject** eligibility; trigger disbursement | set the amount · see PII · redirect funds |
| **Contract (TEE)** | derive amount from program rules, resolve PII in the enclave, write the audit log | — |
| **AI Agent** | interpret instructions, orchestrate across programs, explain/summarize | hold keys · see PII · make the financial decision |

**Why it is safe even though the issuer sees data:** the issuer already legitimately holds that data (the tax office knows income, the civil registry knows residency) — no new PII leaks. The issuer does not disburse funds, and the only thing that crosses domain boundaries is a **minimal signed claim** (`income=low`), never the raw figure. No single party holds all the data.

---

## End-to-end flow

```
1. APPLY     Recipient proves identity (national ID) → issuer signs the ACTUAL
             attributes (income ✍️ Tax, region + household ✍️ Civil Registry). No file uploads.
2. PREVIEW   Signatures verified instantly → "looks eligible: G1 Rp 700k" or "not eligible".
3. APPROVAL  Operator sees the queue: attested attribute badges (NO PII, NO name)
             → APPROVE → eligibility record written to KV `eligibility` (LIVE) + audit.
4. DECISION  check-eligibility (LIVE) → contract assigns tier/benefit and amount.
             prepare-batch (LIVE) → approved list + total within budget.
5. DISBURSE  disburse → enclave resolves the name → provider records it. Agent sees only tx_id.
6. RECEIPT   Recipient sees "Aid {Tier}: Rp ___ received" (display only; not real money).
```

---

## Multi-program platform

TrustDrop is not a single program — it is a **disbursement platform**: many aid programs with different criteria, in **one contract**, selected by `program_id`.

- **Eligibility records are universal facts** (region / income / household, signed by an issuer). Seeded once per recipient and reused across programs.
- **Policy is per-program**, keyed by `program_id`. The contract loads `policy[program_id]` and evaluates the universal facts against it.
- **Eligibility matching is a deterministic system task** (TypeScript + contract), **not** an AI task. The AI only explains (recipient side) and orchestrates/summarizes (operator side).
- **Citizens choose** which of the programs they qualify for to apply to (pre-checked by default) — not auto-enrolled.
- **Dedup per program + period** via the `disbursed-<program_id>-<period>` ledger.
- **Hard security rule:** `execute-disbursement` **re-verifies eligibility inside the TEE** against `policy[program_id]` and computes the authoritative amount there — it never trusts an "eligible" claim from outside the enclave (this blocks an agent bypass).

### Programs (`data/programs.json`)

| Program | Institution | Criteria | Benefit | Budget |
|---|---|---|---|---|
| `jkt-cash-2026` | Dinas Sosial DKI Jakarta | region JKT, income low/medium | **tier** (G1–G3) | Rp 50M |
| `bdg-food-2026` | Dinas Sosial Kota Bandung | region BDG, income low | **flat** Rp 500k | Rp 20M |
| `elderly-national-2026` | Kementerian Sosial RI | all regions, income low/medium, household = elderly | **flat** Rp 300k | Rp 30M |

### Tiers (for `tier`-mode programs) — amount set by the contract

| Tier | Condition | Amount |
|---|---|---|
| **G1 — Priority** | `income=low` & household ∈ {elderly, disabled, single_parent} | Rp 700,000 |
| **G2 — Regular** | `income=low` & household ∈ {head_of_family, married} | Rp 600,000 |
| **G3 — Middle** | `income=medium` | Rp 400,000 |
| *(Not eligible)* | `income=high`, region out of scope, or not attested | — |

---

## How it maps to the SDK (judging scorecard)

Every row below is exercised by the project — this is the evidence for the "full SDK integration" criterion.

| SDK feature | Where it is used | Proves |
|---|---|---|
| **DID** (agent & institution identity) | Agent and operator each have a `did:t3n` | Verifiable identity |
| **`agent-auth-update`** (policy-bound delegation) | Recipient/institution signs a grant: agent → functions → `allowedHosts` | Scoped authorization |
| **TEE contract** (Rust → WASM) | 3 functions: eligibility, batch, disburse | Trusted logic in the enclave |
| **`http-with-placeholders`** | Bank/identity fields resolved via `{{profile.*}}` | PII never reaches the agent |
| **`kv-store`** (sealed storage) | Eligibility records, secrets, per-program dedup ledger | Custody of sensitive data |
| **Selective disclosure / signed claims** | Eligibility verified without raw values | Privacy-preserving |
| **Audit ledger** | A record of every decision and disbursement (no PII) | Anti-fraud accountability |
| **Compliance gate** | Rejects double-claims and out-of-policy runs; re-verifies in TEE | Execution within bounds |

---

## Architecture

```
Recipient ─┐                          ┌─ Issuer sandbox (ed25519, ground-truth)
           ├─ Next.js (UI + API) ─────┤
Operator ──┘   /app: 3 consoles       ├─ AI Agent (Groq, outside TEE, no PII)
                                       └─ T3N / TEE contract  ─→  Mock provider (Upstash)
                                          (eligibility, tiers,        (ledger + receipt)
                                           audit; resolves PII)
```

### 1. TEE contract — Rust → WASM (`contract/`) — v0.4.0
A WASM component (`wasm32-wasip2`) running in the T3N enclave. Three WIT functions, all program-aware:

| Function | File | Job |
|---|---|---|
| `check-eligibility` | `src/eligibility.rs` | requires `attested`; assigns tier/benefit + amount for the given `program_id`; returns `{eligible, reason_code, tier, amount}` |
| `prepare-batch` | `src/batch.rs` | scans eligibility, derives amount from program rules, checks dedup + budget |
| `execute-disbursement` | `src/disburse.rs` | re-verifies eligibility in the enclave, pays the provider via placeholders (name resolved in-enclave), writes audit |

The amount is **computed from the contract's program rules** (`assign_tier` / `flat_amount`), never from operator input.

### 2. Issuer attestation (`lib/issuer/`, `lib/eligibility/`)
- `issuer.ts` — ed25519 sign/verify (`@noble/ed25519`), keys from a deterministic seed.
- `registry.ts` — mixed ground-truth dataset (`data/issuer-registry.json`); the issuer signs the **real values**, so a wealthy applicant stays `high` and is rejected.
- `tiers.ts` / `programs.ts` — mirror of the contract's tier and program-matching rules in TS, for instant previews and policy verification.

### 3. AI agent layer (`lib/agent/`, `app/api/agent/`)
- Lives in Node, **outside the TEE**, and never touches PII or holds keys.
- Groq `llama-3.3-70b-versatile` parses operator instructions, orchestrates approve/reject/disburse across `program_id` pairs, and summarizes runs.
- The recipient-side `/api/recipient/explain` uses the LLM only to explain eligibility in plain language.
- All financial authority stays with the contract (policy + in-TEE re-verification) and the human operator.

### 4. Backend API routes (`app/api/`)
| Route | Function | Mode |
|---|---|---|
| `GET /api/programs` | list available programs | app |
| `POST /api/issuer/attest` | issuer signs claims from ground truth | simulated |
| `POST /api/recipient/apply` | verify signatures + store pending (one application per program) | app |
| `POST /api/recipient/explain` | plain-language eligibility explanation (LLM) | app |
| `GET /api/operator/applications` | application queue (no PII) | app |
| `POST /api/operator/decision` | approve → seed `eligibility` + audit | **LIVE** |
| `POST /api/contract/check-eligibility` | verify eligibility + tier/benefit | **LIVE** |
| `POST /api/contract/prepare-batch` | build batch + amount from program rules | **LIVE** |
| `POST /api/contract/disburse` | agent → TEE for registered DIDs (`source: tee`); hybrid fallback otherwise (`source: system`) | **LIVE / hybrid** |
| `POST /api/agent` · `POST /api/agent/authorize` | agent orchestration + delegation grant | app |
| `GET /api/audit` | decision + disbursement log (no PII) | app |
| `GET /api/evidence` | live evidence strip (contract ID, agent DID, TEE labels) | app |
| `GET /api/mock-provider` | disbursement ledger (dashboard + receipt) | existing |

### 5. Frontend (`app/`)
- **`/` Landing** — feature sections: thesis, the three frauds it kills, how-it-works, live stats, the money-shot contrast, ledger.
- **`/app` Console** — role picker:
  - **Recipient**: enter national ID → attestation certificate cards + eligibility preview → pick programs → Apply.
  - **Operator**: queue + attested attribute badges → Approve/Reject → Check eligibility / Prepare batch / Disburse (no PII), labelled per program.
  - **Auditor**: public ledger (decisions + disbursements) with a live evidence strip — no PII.

---

## Tech stack

- **TEE contract:** Rust + `wit-bindgen`, target `wasm32-wasip2` — v0.4.0
- **Attestation:** `@noble/ed25519` (signing) + `@noble/hashes`
- **SDK:** `@terminal3/t3n-sdk` (Node ≥ 18)
- **AI agent:** Groq `llama-3.3-70b-versatile` (`groq-sdk`), outside the trust path
- **Frontend + API:** Next.js 16 (App Router, Turbopack, TS, Tailwind 4)
- **Persistence:** Upstash Redis (`@upstash/redis`)
- **Tests:** Vitest (TS logic), `cargo test` (contract)

---

## Setup

### Prerequisites
1. A **Terminal 3 developer key** ([claim page](https://www.terminal3.io/claim-page)).
2. **Node.js ≥ 18**, **Rust** + `rustup target add wasm32-wasip2`.

### Environment (`.env.local`)
```bash
T3N_API_KEY=...            # operator key (credited account) — required for live routes
AGENT_KEY=...              # agent signing key (credited)
R1_KEY=...                 # demo recipient identities (bootstrap-identity.ts)
R2_KEY=...
GROQ_API_KEY=...           # AI agent / LLM layer
DISBURSE_PERIOD=2026-07

# Enclave POST target — the same app dashboard base URL (no /api/mock-provider)
MOCK_PROVIDER_URL=https://trustdrop26.vercel.app

# Issuer sandbox (optional; a default dev seed is used if empty)
ISSUER_TAX_SEED=...
ISSUER_CIVIL_SEED=...

# Persistence (required on Vercel; optional locally) — one of these pairs:
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
# or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

> **Note on credits:** T3N testnet credits are per-DID and cannot be pooled — the caller pays. `becomeDevTenant` mints welcome credits to an email-verified DID. Use `scripts/bootstrap-identity.ts <label> <email>` to generate a keypair, self-admit, and print the DID and balance.

---

## Running

```bash
# Contract → WASM + tests
npm run contract:build
cd contract && cargo test --lib --target x86_64-pc-windows-msvc   # 17/17

# TS logic tests (issuer, tiers, program matching)
npm test                          # vitest, 18/18

# Testnet provisioning: register contract v0.4.0, seed per-program policy, empty eligibility
npx tsx --env-file=.env.local scripts/provision.ts

# Dashboard + console
npm run dev                       # http://localhost:3000  ·  /app
```

### Demo flow (UI)
1. **`/app` → Recipient**: pick a sample national ID (e.g. `…0006` low/elderly → G1; `9999…0001` high → rejected) → Request attestation → select programs → Apply.
2. **Operator**: see the queue → Approve → Check eligibility (live) → Prepare batch (live) → Disburse.
3. **Auditor**: review decisions + disbursements (no PII). The landing money-shot shows the name appears only on the provider side.

> **Tip:** change `DISBURSE_PERIOD` or the recipient to see new rows — dedup skips any recipient+program+period already disbursed.

### Real enclave path (optional)
`scripts/onboard-recipient.ts` runs a real `execute-disbursement` (OTP + grant + in-enclave placeholder resolve):
```bash
npx tsx --env-file=.env.local scripts/onboard-recipient.ts <email>
```

---

## Privacy & what is simulated

Recipient PII never enters the memory of the agent, the contract, or the operator's browser. The issuers (Tax / Civil Registry) are sandbox keypairs over a synthetic dataset — no real government records are used; disbursement hits a mock provider, not a real bank; the funds are display figures only. Signature verification currently lives in the app layer; moving it into the enclave is a hardening step for a future phase.

## Status & disclaimer

Hackathon project (*Terminal 3 Agent Dev Kit Bounty Challenge*). Synthetic data, sandbox tokens, simulated eligibility rules. **This is not a government production system.**

## License

MIT.
