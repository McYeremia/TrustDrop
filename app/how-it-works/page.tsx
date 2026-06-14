import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/app/_ui/SiteNav";
import { SiteFooter } from "@/app/_ui/SiteFooter";

export const metadata: Metadata = {
  title: "How it works — TrustDrop",
  description:
    "Apply → approve → disburse, with PII sealed in the enclave and amounts fixed by the contract.",
};

const PIPELINE = [
  { k: "Operator", d: "Sets policy & approves the run", pii: false },
  { k: "AI Agent", d: "Orchestrates · sends instructions", pii: false },
  { k: "TEE Enclave", d: "Resolves PII · calls provider", pii: true, seal: true },
  { k: "Provider", d: "Receives resolved PII", pii: true },
];

const STEPS = [
  {
    k: "Apply",
    d: "The citizen proves identity with their NIK. Issuers (tax office, civil registry) sign their TRUE attributes with ed25519. No file upload, no self-declaration.",
  },
  {
    k: "Preview",
    d: 'Signatures are verified instantly — "looks eligible: Tier G1, Rp 700,000" or "not eligible". Transparent, but not yet binding.',
  },
  {
    k: "Approve",
    d: "The operator sees attested attributes only — badges like ✓ income=low · Tax Office — never the raw salary, never the name. One accountable click: approve or reject.",
  },
  {
    k: "Decide",
    d: "check-eligibility runs in the contract and assigns the tier & amount from the policy rule. The operator never types a number.",
  },
  {
    k: "Disburse",
    d: "The enclave resolves the citizen's name and pays the provider. The agent receives only a tx_id and status — the name is sanitised out.",
  },
  {
    k: "Receive",
    d: "The recipient sees their aid landed. Every decision and payment is sealed to an immutable, PII-free audit trail.",
  },
];

const TIERS = [
  { t: "G1 — Priority", c: "income = low + elderly / disabled / single parent", a: "Rp 700,000" },
  { t: "G2 — Standard", c: "income = low + head of family / married", a: "Rp 600,000" },
  { t: "G3 — Near-poor", c: "income = medium", a: "Rp 400,000" },
];

const TRUST = [
  { who: "Citizen", can: "Owns their PII · applies · sees their aid", cannot: "—", tone: "ink" },
  { who: "Issuer", can: "Signs attribute claims from its own records", cannot: "Cannot disburse", tone: "ink" },
  { who: "Operator", can: "Approves / rejects eligibility", cannot: "No amount · no PII · no diversion", tone: "pii" },
  { who: "Contract (TEE)", can: "Assigns tier · resolves PII · writes audit", cannot: "—", tone: "seal" },
];

export default function HowItWorks() {
  return (
    <div
      className="grain relative min-h-screen overflow-x-hidden"
      style={{ background: "#080808" }}
    >
      <SiteNav />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="guilloche pointer-events-none absolute inset-0 h-[360px]" />
        {/* Gold ambient top-left */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-20 rounded-full"
          style={{
            width: 500,
            height: 400,
            background: "radial-gradient(ellipse, rgba(240,169,59,0.1), transparent 70%)",
            filter: "blur(70px)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-20 sm:px-10">
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            How it works
          </span>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tighter text-white sm:text-6xl">
            Apply, approve, disburse —{" "}
            <span className="gold-shine gold-glow">without anyone untrusted</span>{" "}
            seeing a name.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: "#8a8a8a" }}>
            The agent and operator only ever send instructions. The Trusted
            Execution Environment resolves identity, calls the provider, and
            sanitises the response — so PII never crosses into untrusted hands.
          </p>
        </div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIPELINE.map((n, i) => (
            <div key={n.k} className="relative">
              {i > 0 && (
                <div className="flow-line absolute -left-3 top-9 hidden h-0.5 w-3 sm:block" />
              )}
              <div
                className={`reveal h-full rounded-xl p-5 dark-stat-card ${
                  n.seal
                    ? "border-seal/50 seal-pulse"
                    : ""
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#444" }}>
                    {`0${i + 1}`}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                      n.pii
                        ? "border-pii/40 bg-pii/10 text-pii"
                        : "border-seal/30 bg-seal/10 text-seal"
                    }`}
                  >
                    {n.pii ? "PII" : "0 PII"}
                  </span>
                </div>
                <div className="font-mono text-base font-bold text-white">{n.k}</div>
                <div className="mt-1 text-xs leading-snug" style={{ color: "#777" }}>
                  {n.d}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider"
          style={{ color: "#444" }}
        >
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          the PII boundary — left: never sees the data · right: only inside the enclave
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>
      </section>

      {/* ── Steps ────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <h2 className="mb-10 text-3xl font-black tracking-tighter text-white sm:text-4xl">
          Six steps,{" "}
          <span className="gold-shine">one sealed identity</span>
        </h2>
        <ol
          className="relative space-y-4 border-l pl-8"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          {STEPS.map((s, i) => (
            <li
              key={s.k}
              className="reveal relative"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Gold numbered disc */}
              <div
                className="absolute -left-[3.05rem] top-0 grid size-7 place-items-center rounded-full font-mono text-xs font-bold"
                style={{
                  background: "rgba(240,169,59,0.12)",
                  border: "1px solid rgba(240,169,59,0.4)",
                  color: "#f0a93b",
                }}
              >
                {i + 1}
              </div>
              <div className="dark-stat-card rounded-xl p-5">
                <div className="font-mono text-base font-bold text-white">{s.k}</div>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#7a7a7a" }}>
                  {s.d}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Tiers ────────────────────────────────────────────────────────── */}
      <section
        className="relative z-10 border-y"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <h2 className="text-3xl font-black tracking-tighter text-white sm:text-4xl">
            Amounts the operator{" "}
            <span className="gold-shine">can&rsquo;t touch</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "#7a7a7a" }}>
            The contract maps attested attributes to a fixed benefit tier. The
            figure is policy, not discretion.
          </p>
          <div
            className="mt-8 overflow-hidden rounded-2xl border"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            {TIERS.map((t, i) => (
              <div
                key={t.t}
                className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-4 px-6 py-5"
                style={{
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="gold-shine font-mono text-base font-bold">{t.t}</div>
                <div className="font-mono text-xs sm:text-sm" style={{ color: "#666" }}>
                  {t.c}
                </div>
                <div className="font-mono text-base font-bold text-white">{t.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust model ──────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <h2 className="mb-8 text-3xl font-black tracking-tighter text-white sm:text-4xl">
          Who can do what
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRUST.map((r) => (
            <div key={r.who} className="dark-stat-card rounded-2xl p-5">
              <div
                className={`font-mono text-base font-bold ${
                  r.tone === "seal"
                    ? "text-seal"
                    : r.tone === "pii"
                      ? "text-pii"
                      : "text-white"
                }`}
              >
                {r.who}
              </div>
              <div
                className="mt-2 flex items-start gap-2 text-sm"
                style={{ color: "#7a7a7a" }}
              >
                <span className="mt-0.5 text-seal">✓</span> {r.can}
              </div>
              {r.cannot !== "—" && (
                <div
                  className="mt-1 flex items-start gap-2 text-sm"
                  style={{ color: "#555" }}
                >
                  <span className="mt-0.5 text-alert">✕</span> {r.cannot}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Link href="/demo" className="gold-btn rounded-full px-6 py-3 font-mono text-sm uppercase tracking-wider">
            See it live →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
