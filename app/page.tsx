"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { rupiah, shortDid, SectionLabel, Field, Corner, Empty } from "@/app/_ui/primitives";

interface Disbursement {
  received_at: string;
  tx_id: string;
  recipient_did: string;
  recipient_name: string;
  amount: number;
  currency: string;
  period: string;
  run_id: string;
  extra: Record<string, unknown>;
}

const CONTRACT = "z:cdbdf0…0100a:bansos-contracts";
const VERSION = "v0.3.0";

export default function Home() {
  const [rows, setRows] = useState<Disbursement[]>([]);
  const [live, setLive] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/mock-provider", { cache: "no-store" });
        const data = (await res.json()) as { disbursements: Disbursement[] };
        if (!active) return;
        setLive(true);
        const incoming = data.disbursements ?? [];
        const newIds = incoming.map((d) => d.tx_id).filter((id) => !seen.current.has(id));
        if (newIds.length) {
          newIds.forEach((id) => seen.current.add(id));
          setFresh(new Set(newIds));
          setTimeout(() => active && setFresh(new Set()), 1500);
        }
        setRows(incoming);
      } catch {
        if (active) setLive(false);
      }
    }
    poll();
    const t = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const latest = rows[0];

  return (
    <div className="grain relative min-h-full overflow-x-hidden">
      <div className="vault-grid pointer-events-none absolute inset-0 h-[520px]" />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between border-b border-line/70 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <SealMark />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight text-ink">
              TrustDrop
            </div>
            <div className="text-[10px] uppercase tracking-engrave text-ink-faint">
              Verified Social-Aid Disbursement
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-ink-dim">
          <span className="hidden font-mono lg:inline">{CONTRACT}</span>
          <span className="rounded-full border border-line bg-vault-850 px-2 py-1 font-mono text-ink-dim">
            {VERSION}
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-vault-850 px-2.5 py-1 font-mono uppercase tracking-wider sm:flex">
            <span
              className={`size-1.5 rounded-full ${live ? "bg-seal seal-pulse" : "bg-ink-faint"}`}
            />
            {live ? "testnet · live" : "connecting"}
          </span>
          <Link
            href="/app"
            className="rounded-full border border-seal/40 bg-seal/10 px-3 py-1 font-mono uppercase tracking-wider text-seal transition hover:bg-seal/20"
          >
            Open console →
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-10 sm:px-10">
        <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-seal/30 bg-seal/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-seal">
          <span className="size-1.5 rounded-full bg-seal" />
          Terminal 3 · Agent Auth SDK
        </p>
        <h1
          className="rise font-display text-5xl leading-[0.98] tracking-tight text-ink sm:text-7xl"
          style={{ animationDelay: "60ms" }}
        >
          A citizen&rsquo;s private data
          <br />
          <span className="text-ink-dim">never leaves the</span>{" "}
          <span className="relative whitespace-nowrap text-seal">
            enclave
            <svg
              className="absolute -bottom-2 left-0 w-full"
              height="10"
              viewBox="0 0 300 10"
              fill="none"
              preserveAspectRatio="none"
            >
              <path d="M2 7C60 3 240 3 298 7" stroke="var(--seal)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            </svg>
          </span>
          .
        </h1>
        <p
          className="rise mt-7 max-w-2xl text-lg leading-relaxed text-ink-dim"
          style={{ animationDelay: "140ms" }}
        >
          An AI agent verifies eligibility and disburses social aid{" "}
          <span className="text-ink">on behalf of the institution</span> —
          without ever seeing a citizen&rsquo;s ID number, name, or bank
          account. PII is resolved inside a{" "}
          <span className="text-ink">Trusted Execution Environment</span>, with
          an audit trail that cannot be altered.
        </p>
        <p
          className="rise mt-6 max-w-2xl border-l-2 border-pii/40 pl-4 text-sm italic leading-relaxed text-ink-faint"
          style={{ animationDelay: "200ms" }}
        >
          Inspired by a real-world problem in Indonesia, where social aid
          (<span className="not-italic">bansos</span>) doesn&rsquo;t always
          reach the people it&rsquo;s meant for.
        </p>
        <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "260ms" }}>
          <Link
            href="/app"
            className="rounded-lg border border-seal/40 bg-seal/15 px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25"
          >
            Launch the console →
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-line bg-vault-850 px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink-dim transition hover:text-ink"
          >
            How it works
          </a>
        </div>
      </section>

      {/* ── Pipeline ── */}
      <Pipeline />

      {/* ── Thesis ── */}
      <ThesisBand />

      {/* ── Frauds eliminated ── */}
      <FraudsEliminated />

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Live stats ── */}
      <LiveStats rows={rows} />

      {/* ── Money shot ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:px-10">
        <SectionLabel n="01" title="The money shot" sub="One transaction, two levels of visibility" />
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <ProviderView d={latest} />
          <Divider />
          <AgentView d={latest} />
        </div>
      </section>

      {/* ── Live ledger ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <SectionLabel
          n="02"
          title="Disbursement ledger received by the provider"
          sub={`${rows.length} transactions · refreshed every 2.5s`}
        />
        <Ledger rows={rows} fresh={fresh} />
        <p className="mt-5 font-mono text-xs leading-relaxed text-ink-faint">
          &gt; run{" "}
          <span className="text-ink-dim">
            npx tsx --env-file=.env.local scripts/onboard-recipient.ts &lt;email&gt;
          </span>{" "}
          → a new row appears live above when the enclave calls the provider.
        </p>
      </section>

      <footer className="relative z-10 border-t border-line/60 px-6 py-6 text-center font-mono text-[11px] text-ink-faint sm:px-10">
        TrustDrop · T3N testnet demo · synthetic data · not a government production system
      </footer>
    </div>
  );
}

/* ───────────────────────── Components ───────────────────────── */

function SealMark() {
  return (
    <div className="relative grid size-9 place-items-center rounded-md border border-seal/40 bg-seal/10">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" stroke="var(--seal)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 12l2.5 2.5 4.5-5" stroke="var(--seal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Pipeline() {
  const nodes = [
    { k: "Operator", d: "Institution sets policy & approves the run", pii: false },
    { k: "AI Agent", d: "Orchestrates · sends instructions", pii: false },
    { k: "TEE Enclave", d: "Resolves PII · calls provider", pii: true, seal: true },
    { k: "Provider", d: "Receives resolved PII", pii: true },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-14 sm:px-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {nodes.map((n, i) => (
          <div key={n.k} className="relative">
            {i > 0 && <div className="flow-line absolute -left-3 top-9 hidden h-0.5 w-3 sm:block" />}
            <div
              className={`rise h-full rounded-lg border bg-vault-900/70 p-4 backdrop-blur ${
                n.seal ? "border-seal/40 seal-pulse" : "border-line"
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  0{i + 1}
                </span>
                {n.pii ? (
                  <span className="rounded border border-pii/40 bg-pii/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-pii">
                    PII
                  </span>
                ) : (
                  <span className="rounded border border-seal/30 bg-seal/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-seal">
                    0 PII
                  </span>
                )}
              </div>
              <div className="font-display text-base text-ink">{n.k}</div>
              <div className="mt-1 text-xs leading-snug text-ink-dim">{n.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        the PII boundary — left: never sees the data · right: only inside the enclave
        <span className="h-px flex-1 bg-line" />
      </div>
    </section>
  );
}

function ProviderView({ d }: { d?: Disbursement }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-pii/40 bg-gradient-to-b from-pii/[0.07] to-transparent p-6">
      <Corner color="var(--pii)" />
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded border border-pii/40 bg-pii/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-pii">
          Inside enclave → provider
        </span>
      </div>
      <h3 className="font-display text-xl text-ink">What the provider receives</h3>
      <p className="mb-5 text-sm text-ink-dim">Citizen PII, resolved by the host inside the TEE.</p>

      {d ? (
        <dl className="space-y-3 font-mono text-sm">
          <Field label="recipient_name" value={d.recipient_name} pii />
          <Field label="amount" value={rupiah(d.amount)} />
          <Field label="recipient_did" value={shortDid(d.recipient_did)} dim />
          <Field label="period" value={d.period} dim />
        </dl>
      ) : (
        <Empty tone="pii" />
      )}
    </div>
  );
}

function AgentView({ d }: { d?: Disbursement }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-seal/40 bg-gradient-to-b from-seal/[0.06] to-transparent p-6">
      <Corner color="var(--seal)" />
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded border border-seal/40 bg-seal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-seal">
          Response to agent · sanitised
        </span>
      </div>
      <h3 className="font-display text-xl text-ink">What the agent sees</h3>
      <p className="mb-5 text-sm text-ink-dim">Only status & tx_id. Zero PII.</p>

      {d ? (
        <dl className="space-y-3 font-mono text-sm">
          <Field label="status" value="SUCCESS" seal />
          <Field label="tx_id" value={d.tx_id} />
          <Field label="recipient_did" value={shortDid(d.recipient_did)} dim />
          <div className="flex items-center justify-between border-t border-line/60 pt-3">
            <span className="text-ink-faint">recipient_name</span>
            <span className="rounded bg-vault-800 px-2 py-0.5 text-ink-faint line-through decoration-alert/70">
              never seen
            </span>
          </div>
        </dl>
      ) : (
        <Empty tone="seal" />
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="relative flex items-center justify-center lg:flex-col">
      <div className="hidden h-full w-px bg-gradient-to-b from-transparent via-line to-transparent lg:block" />
      <div className="grid size-10 place-items-center rounded-full border border-line bg-vault-850 lg:absolute">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="var(--ink-dim)" strokeWidth="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--ink-dim)" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

function Ledger({ rows, fresh }: { rows: Disbursement[]; fresh: Set<string> }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-line py-16 text-center">
        <p className="font-mono text-sm text-ink-faint">No disbursements recorded yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-vault-900/50">
      <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1.2fr] gap-4 border-b border-line/70 bg-vault-850 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span>recipient_name (PII)</span>
        <span>tx_id</span>
        <span>amount</span>
        <span className="text-right">received_at</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.tx_id}
          className={`grid grid-cols-[1.4fr_1fr_0.8fr_1.2fr] items-center gap-4 border-b border-line-soft px-5 py-3.5 font-mono text-sm last:border-0 ${
            fresh.has(r.tx_id) ? "ledger-in" : ""
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="size-1.5 shrink-0 rounded-full bg-pii" />
            <span className="truncate text-pii">{r.recipient_name}</span>
          </span>
          <span className="truncate text-ink-dim">{r.tx_id}</span>
          <span className="text-ink">{rupiah(r.amount)}</span>
          <span className="truncate text-right text-ink-faint">
            {new Date(r.received_at).toLocaleTimeString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Landing feature sections ───────────────────────── */

function ThesisBand() {
  const cards = [
    { k: "How much", v: "Decided by the contract", d: "Benefit tiers are fixed in the TEE rule — the operator can never set or inflate an amount.", tone: "seal" },
    { k: "Who", v: "Sealed in the enclave", d: "The citizen's name is resolved only inside the TEE at payment time; the agent never sees it.", tone: "seal" },
    { k: "Eligibility", v: "Proven by signed attestations", d: "Issuers (tax, civil registry) sign the truth. A forged claim simply won't verify.", tone: "pii" },
  ] as const;
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-14 sm:px-10">
      <SectionLabel n="—" title="The operator may only say “yes”" sub="Not “how much”, not “who”" />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.k} className="rounded-xl border border-line bg-vault-900/60 p-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{c.k}</div>
            <div className={`mt-1 font-display text-lg ${c.tone === "pii" ? "text-pii" : "text-seal"}`}>{c.v}</div>
            <p className="mt-2 text-sm leading-snug text-ink-dim">{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FraudsEliminated() {
  const frauds = [
    { t: "Fake poverty letters (SKTM)", d: "A wealthy applicant can't make the tax office sign “low income” — attestations come from authoritative issuers, not forgeable paper." },
    { t: "Ghost / duplicate recipients", d: "One identity, one claim per period — the contract's dedup ledger rejects repeats." },
    { t: "Skimming the amount", d: "Operators never type a number; the contract assigns the tier amount, so there's nothing to mark up." },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-14 sm:px-10">
      <SectionLabel n="—" title="Three frauds, eliminated" sub="By design, not by trust" />
      <div className="grid gap-4 md:grid-cols-3">
        {frauds.map((f) => (
          <div key={f.t} className="rounded-xl border border-line bg-gradient-to-b from-alert/[0.05] to-transparent p-5">
            <div className="mb-2 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-alert">
              <span className="size-1.5 rounded-full bg-alert" /> blocked
            </div>
            <div className="font-display text-base text-ink">{f.t}</div>
            <p className="mt-2 text-sm leading-snug text-ink-dim">{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { k: "Apply", d: "Citizen proves identity (NIK); issuers sign their true attributes. No file upload." },
    { k: "Preview", d: "Signatures verified instantly — “looks eligible: G1” or “not eligible”." },
    { k: "Approve", d: "Operator sees attested attributes only (no PII, no raw numbers) and approves." },
    { k: "Decide", d: "check-eligibility (live) assigns tier & amount from the contract rule." },
    { k: "Disburse", d: "The enclave resolves the name and pays the provider; the agent sees only a tx_id." },
    { k: "Receive", d: "The recipient sees their aid landed — every step on an immutable audit trail." },
  ];
  return (
    <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 pb-14 sm:px-10">
      <SectionLabel n="—" title="How it works" sub="Apply → approve → disburse" />
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.k} className="flex gap-3 rounded-xl border border-line bg-vault-900/50 p-4">
            <span className="font-mono text-sm text-seal">{`0${i + 1}`}</span>
            <div>
              <div className="font-display text-base text-ink">{s.k}</div>
              <p className="mt-1 text-sm leading-snug text-ink-dim">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <Link
          href="/app"
          className="inline-block rounded-lg border border-seal/40 bg-seal/15 px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25"
        >
          Try it in the console →
        </Link>
      </div>
    </section>
  );
}

function LiveStats({ rows }: { rows: Disbursement[] }) {
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const stats = [
    { k: "Recipients aided", v: String(rows.length) },
    { k: "Total disbursed", v: rupiah(total) },
    { k: "PII seen by the agent", v: "0" },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-14 sm:px-10">
      <div className="grid gap-4 rounded-2xl border border-line bg-vault-900/60 p-6 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.k} className="text-center">
            <div className="font-display text-3xl text-seal">{s.v}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
