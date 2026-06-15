"use client";

import { useState, Fragment } from "react";
import { rupiah, shortDid, SectionLabel } from "@/app/_ui/primitives";

interface Attestation {
  issuer: string;
  claims: Record<string, string>;
  issued_at: string;
  signature: string;
}
type ProgramMatch =
  | { program_id: string; name: string; institution: string; period: string; eligible: true; tier: string; amount: number }
  | { program_id: string; name: string; institution: string; period: string; eligible: false; reason: string };

interface AttestResult {
  ok: boolean;
  reason?: string;
  recipient_did?: string;
  attributes?: { region_code: string; income_bracket: string; household_status: string };
  attestations?: Attestation[];
  matches?: ProgramMatch[];
}

const DEMO = [
  { nik: "3201010101010006", hint: "JKT · low · elderly" },
  { nik: "3201010101010004", hint: "JKT · medium · married" },
  { nik: "3201010101010003", hint: "BDG · low · head" },
  { nik: "9999000000000001", hint: "JKT · high income" },
];

const REASON_LABEL: Record<string, string> = {
  REGION_MISMATCH: "region not covered",
  INCOME_MISMATCH: "income bracket not eligible",
  HOUSEHOLD_MISMATCH: "household criteria not met",
};

const STEPS = ["Verify identity", "Review programs", "Claim aid"];

export default function RecipientConsole() {
  const [nik, setNik] = useState("");
  const [att, setAtt] = useState<AttestResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  async function requestAttestation(value?: string) {
    const useNik = value ?? nik;
    setBusy(true);
    setApplyMsg(null);
    setClaimed(false);
    setExplanation(null);
    // NOTE: we deliberately keep the previous `att` mounted while the new one
    // loads. Clearing it here made the stepper bounce 2→1→2 (a visible flicker
    // of the step numbers) and collapsed the panel, causing a scroll jump.
    try {
      const res = await fetch("/api/issuer/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nik: useNik }),
      });
      const data: AttestResult = await res.json();
      setAtt(data);
      // Default-check every eligible program.
      setSelected(
        data.ok && data.matches
          ? new Set(data.matches.filter((m) => m.eligible).map((m) => m.program_id))
          : new Set(),
      );
    } finally {
      setBusy(false);
    }
  }

  function toggle(pid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  async function explain() {
    if (!att?.matches) return;
    setExplaining(true);
    setExplanation(null);
    try {
      const res = await fetch("/api/recipient/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matches: att.matches }),
      });
      const data = await res.json();
      setExplanation(data.ok ? data.explanation : `Could not explain: ${data.error}`);
    } finally {
      setExplaining(false);
    }
  }

  async function apply() {
    if (!att?.ok || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/recipient/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient_did: att.recipient_did,
          attributes: att.attributes,
          attestations: att.attestations,
          program_ids: [...selected],
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setApplyMsg(`✗ ${data.reason}`);
      } else {
        const parts: string[] = [];
        if (data.count > 0) {
          parts.push(`Submitted ${data.count} application${data.count > 1 ? "s" : ""} — pending operator review.`);
          setClaimed(true);
        }
        const skipped = (data.skipped ?? []) as { program_id: string; status: string }[];
        if (skipped.length > 0) {
          parts.push(
            `${skipped.length} program${skipped.length > 1 ? "s" : ""} already applied (one submission each) — waiting on: ${skipped
              .map((s) => s.status)
              .join(", ")}.`,
          );
        }
        setApplyMsg(parts.join(" "));
      }
    } finally {
      setBusy(false);
    }
  }

  const eligible = att?.matches?.filter((m) => m.eligible) ?? [];
  const ineligible = att?.matches?.filter((m) => !m.eligible) ?? [];
  const selectedTotal = eligible.reduce(
    (s, m) => (m.eligible && selected.has(m.program_id) ? s + m.amount : s),
    0,
  );
  const stage = claimed ? 3 : att?.ok ? 2 : 1;

  return (
    <div>
      <SectionLabel n="R" title="Find & claim social aid" sub="Prove identity · no file upload" />

      {/* Progress stepper */}
      <Stepper stage={stage} />

      {/* NIK input */}
      <div className="cta-dark-card rounded-xl p-6">
        <label className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Your NIK (national ID)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && nik && requestAttestation()}
            placeholder="3201010101010006"
            className="min-w-[220px] flex-1 rounded-lg border border-line bg-vault-950 px-3 py-2 font-mono text-sm text-ink outline-none transition focus:border-seal/60 focus:shadow-[0_0_0_3px_rgba(240,169,59,0.12)]"
          />
          <button
            onClick={() => requestAttestation()}
            disabled={busy || !nik}
            className="gold-btn rounded-lg px-5 py-2 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && !att ? "Scanning registry…" : "Find aid for me"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">try</span>
          {DEMO.map((d) => (
            <button
              key={d.nik}
              onClick={() => { setNik(d.nik); requestAttestation(d.nik); }}
              disabled={busy}
              className="group rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:-translate-y-px hover:border-seal/40 hover:text-seal disabled:opacity-40"
              title={d.nik}
            >
              {d.hint}
            </button>
          ))}
        </div>

        {/* Transparency note: why NIK-only entry is safe, and what production adds. */}
        <div className="mt-4 rounded-lg border border-line bg-vault-950/50 p-3 text-[11px] leading-relaxed text-ink-faint">
          <span className="font-mono uppercase tracking-wider text-ink-dim">Security ·</span>{" "}
          The NIK here is an <span className="text-ink-dim">identifier</span>, not a secret credential. Only NIKs
          enrolled in the institution&rsquo;s registry can be attested, and funds are always resolved inside the
          enclave to the legitimate recipient&rsquo;s own account — entering someone else&rsquo;s NIK never
          redirects money to anyone.{" "}
          <span className="text-ink-dim">In production</span>, citizens sign in with their own digital identity
          (DID), so only the NIK&rsquo;s owner can apply.
        </div>
      </div>

      {/* Scanning skeleton */}
      {busy && !att && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {att && !att.ok && (
        <div className="rise mt-4 rounded-xl border border-alert/40 bg-alert/10 p-5 font-mono text-sm text-alert">
          {att.reason === "NIK_NOT_IN_REGISTRY"
            ? "This NIK is not in any issuer registry — no attestation can be produced."
            : `Rejected: ${att.reason}`}
        </div>
      )}

      {att?.ok && (
        <div key={att.recipient_did} className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Certificate */}
          <div className="reveal relative overflow-hidden rounded-xl border border-pii/40 bg-gradient-to-b from-pii/[0.06] to-transparent p-6" style={{ animationDelay: "0ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg text-ink">Attestation certificate</span>
              <span className="seal-pulse rounded border border-seal/40 bg-seal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-seal">
                ✓ signature verified
              </span>
            </div>
            <div className="mb-3 font-mono text-[11px] text-ink-faint">subject {shortDid(att.recipient_did ?? "")}</div>
            <div className="space-y-3">
              {att.attestations?.map((a, i) => (
                <div
                  key={a.issuer}
                  className="reveal rounded-lg border border-line bg-vault-950/60 p-3"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-pii">
                    issuer · {a.issuer === "tax" ? "Tax Office (DJP)" : "Civil Registry (Dukcapil)"}
                  </div>
                  {Object.entries(a.claims).map(([k, v]) => (
                    <div key={k} className="flex justify-between font-mono text-sm">
                      <span className="text-ink-faint">{k}</span>
                      <span className="text-ink">{v}</span>
                    </div>
                  ))}
                  <div className="mt-1 truncate font-mono text-[10px] text-ink-faint">sig {a.signature.slice(0, 24)}…</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              The issuer signs your <span className="text-ink-dim">true facts</span>. The same facts are matched
              against every program — you can&rsquo;t fake eligibility.
            </p>
          </div>

          {/* Program matches */}
          <div className="reveal rounded-xl border border-line bg-vault-900/60 p-6" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center justify-between">
              <div className="font-display text-lg text-ink">Programs matched to you</div>
              <button
                onClick={explain}
                disabled={explaining}
                className="rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:-translate-y-px hover:border-seal/40 hover:text-seal disabled:opacity-40"
              >
                {explaining ? "Thinking…" : "✨ Explain with AI"}
              </button>
            </div>

            {explanation && (
              <div className="rise mt-3 rounded-lg border border-seal/30 bg-seal/5 p-3 text-sm leading-relaxed text-ink-dim">
                {explanation}
              </div>
            )}

            {/* Eligible — selectable cards */}
            <div className="mt-4 space-y-2">
              {eligible.length === 0 && (
                <div className="rounded-lg border border-alert/30 bg-alert/5 p-4 font-mono text-sm text-ink-dim">
                  You don&rsquo;t qualify for any program with these attributes.
                </div>
              )}
              {eligible.map((m, i) =>
                m.eligible ? (
                  <label
                    key={m.program_id}
                    style={{ animationDelay: `${180 + i * 80}ms` }}
                    className={`reveal flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all duration-200 ${
                      selected.has(m.program_id)
                        ? "border-seal/60 bg-seal/[0.10] shadow-[0_0_22px_-6px_rgba(240,169,59,0.4)]"
                        : "border-line bg-vault-950/40 hover:border-seal/30 hover:bg-seal/[0.05]"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                        selected.has(m.program_id)
                          ? "border-seal bg-seal text-vault-950"
                          : "border-line text-transparent"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2l2.2 2.3 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.has(m.program_id)}
                      onChange={() => toggle(m.program_id)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-ink">{m.name}</div>
                      <div className="font-mono text-[11px] text-ink-faint">{m.institution}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-seal">{rupiah(m.amount)}</div>
                      <div className="font-mono text-[10px] text-ink-faint">{m.tier}</div>
                    </div>
                  </label>
                ) : null,
              )}
            </div>

            {/* Ineligible — informational */}
            {ineligible.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">not eligible</div>
                {ineligible.map((m) =>
                  !m.eligible ? (
                    <div key={m.program_id} className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-ink-faint line-through">{m.name}</span>
                      <span className="text-alert">{REASON_LABEL[m.reason] ?? m.reason}</span>
                    </div>
                  ) : null,
                )}
              </div>
            )}

            {/* Running total */}
            {eligible.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-vault-950/50 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  {selected.size} selected
                </span>
                <span key={selectedTotal} className="rise font-mono text-base font-bold text-seal">
                  {rupiah(selectedTotal)}
                </span>
              </div>
            )}

            {/* Claim / success */}
            {claimed ? (
              <div className="rise mt-4 flex items-center gap-3 rounded-lg border border-seal/40 bg-seal/10 p-4">
                <span className="seal-pulse grid size-9 shrink-0 place-items-center rounded-full border border-seal/50 bg-seal/15 text-seal">
                  ✓
                </span>
                <div className="text-sm text-ink-dim">{applyMsg}</div>
              </div>
            ) : (
              <>
                <button
                  onClick={apply}
                  disabled={busy || selected.size === 0}
                  className="cta-glow mt-5 w-full rounded-lg border border-seal/40 bg-seal/15 px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-seal/15"
                >
                  {busy
                    ? "Submitting…"
                    : selected.size > 0
                      ? `Claim ${selected.size} program${selected.size > 1 ? "s" : ""}`
                      : "Select a program"}
                </button>
                {applyMsg && <div className="rise mt-3 font-mono text-sm text-ink-dim">{applyMsg}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ stage }: { stage: number }) {
  return (
    <div className="mb-5 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = stage > n;
        const active = stage === n;
        return (
          <Fragment key={label}>
            <div className="flex items-center gap-2.5">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs transition-all duration-300 ${
                  done
                    ? "border-seal bg-seal text-vault-950"
                    : active
                      ? "seal-pulse border-seal/60 bg-seal/15 text-seal"
                      : "border-line bg-vault-850 text-ink-faint"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span
                className={`hidden font-mono text-[11px] uppercase tracking-wider transition-colors sm:inline ${
                  active ? "text-seal" : done ? "text-ink-dim" : "text-ink-faint"
                }`}
              >
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <div className="mx-3 h-px flex-1">
                <div
                  className={`h-full transition-all duration-500 ${stage > n ? "bg-seal/60" : "bg-line"}`}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-xl border border-line bg-vault-900/40 p-6">
      <div className="h-5 w-1/2 animate-pulse rounded bg-vault-700/60" />
      <div className="mt-4 space-y-2">
        <div className="h-12 animate-pulse rounded-lg bg-vault-800/50" />
        <div className="h-12 animate-pulse rounded-lg bg-vault-800/40" />
        <div className="h-12 w-2/3 animate-pulse rounded-lg bg-vault-800/30" />
      </div>
    </div>
  );
}
