"use client";

import { useState } from "react";
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

export default function RecipientConsole() {
  const [nik, setNik] = useState("");
  const [att, setAtt] = useState<AttestResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  async function requestAttestation(value?: string) {
    const useNik = value ?? nik;
    setBusy(true);
    setApplyMsg(null);
    setAtt(null);
    setExplanation(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/issuer/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nik: useNik }),
      });
      const data: AttestResult = await res.json();
      setAtt(data);
      // Default-check every eligible program.
      if (data.ok && data.matches) {
        setSelected(new Set(data.matches.filter((m) => m.eligible).map((m) => m.program_id)));
      }
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
      setApplyMsg(
        data.ok
          ? `✓ Submitted ${data.count} application${data.count > 1 ? "s" : ""} — pending operator review.`
          : `✗ ${data.reason}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const eligible = att?.matches?.filter((m) => m.eligible) ?? [];
  const ineligible = att?.matches?.filter((m) => !m.eligible) ?? [];

  return (
    <div>
      <SectionLabel n="R" title="Find & claim social aid" sub="Prove identity · no file upload" />

      {/* NIK input */}
      <div className="rounded-xl border border-line bg-vault-900/60 p-6">
        <label className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Your NIK (national ID)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            placeholder="3201010101010006"
            className="min-w-[220px] flex-1 rounded-lg border border-line bg-vault-950 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-seal/50"
          />
          <button
            onClick={() => requestAttestation()}
            disabled={busy || !nik}
            className="rounded-lg border border-seal/40 bg-seal/15 px-4 py-2 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:opacity-40"
          >
            Find aid for me
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.nik}
              onClick={() => { setNik(d.nik); requestAttestation(d.nik); }}
              className="rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:text-ink"
              title={d.nik}
            >
              {d.hint}
            </button>
          ))}
        </div>
      </div>

      {att && !att.ok && (
        <div className="mt-4 rounded-xl border border-alert/40 bg-alert/10 p-5 font-mono text-sm text-alert">
          {att.reason === "NIK_NOT_IN_REGISTRY"
            ? "This NIK is not in any issuer registry — no attestation can be produced."
            : `Rejected: ${att.reason}`}
        </div>
      )}

      {att?.ok && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Certificate */}
          <div className="relative overflow-hidden rounded-xl border border-pii/40 bg-gradient-to-b from-pii/[0.06] to-transparent p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg text-ink">Attestation certificate</span>
              <span className="rounded border border-seal/40 bg-seal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-seal">
                ✓ signature verified
              </span>
            </div>
            <div className="mb-3 font-mono text-[11px] text-ink-faint">subject {shortDid(att.recipient_did ?? "")}</div>
            <div className="space-y-3">
              {att.attestations?.map((a) => (
                <div key={a.issuer} className="rounded-lg border border-line bg-vault-950/60 p-3">
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
          <div className="rounded-xl border border-line bg-vault-900/60 p-6">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg text-ink">Programs matched to you</div>
              <button
                onClick={explain}
                disabled={explaining}
                className="rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:text-ink disabled:opacity-40"
              >
                {explaining ? "…" : "✨ Explain with AI"}
              </button>
            </div>

            {explanation && (
              <div className="mt-3 rounded-lg border border-seal/30 bg-seal/5 p-3 text-sm leading-relaxed text-ink-dim">
                {explanation}
              </div>
            )}

            {/* Eligible — checkboxes, default checked */}
            <div className="mt-4 space-y-2">
              {eligible.length === 0 && (
                <div className="rounded-lg border border-alert/30 bg-alert/5 p-4 font-mono text-sm text-ink-dim">
                  You don&rsquo;t qualify for any program with these attributes.
                </div>
              )}
              {eligible.map((m) =>
                m.eligible ? (
                  <label
                    key={m.program_id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-seal/30 bg-seal/[0.06] p-3 transition hover:bg-seal/10"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(m.program_id)}
                      onChange={() => toggle(m.program_id)}
                      className="size-4 accent-[var(--seal)]"
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

            <button
              onClick={apply}
              disabled={busy || selected.size === 0}
              className="mt-5 w-full rounded-lg border border-seal/40 bg-seal/15 px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:opacity-40"
            >
              {selected.size > 0 ? `Claim ${selected.size} program${selected.size > 1 ? "s" : ""}` : "Select a program"}
            </button>
            {applyMsg && <div className="mt-3 font-mono text-sm text-ink-dim">{applyMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
