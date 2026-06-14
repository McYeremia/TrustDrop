"use client";

import { useState } from "react";
import { rupiah, shortDid, SectionLabel } from "@/app/_ui/primitives";

interface Attestation {
  issuer: string;
  claims: Record<string, string>;
  issued_at: string;
  signature: string;
}
interface AttestResult {
  ok: boolean;
  reason?: string;
  recipient_did?: string;
  attributes?: { region_code: string; income_bracket: string; household_status: string };
  attestations?: Attestation[];
  preview?: { eligible: boolean; tier?: string; amount?: number; reason?: string };
}

const DEMO = [
  { nik: "3201010101010006", hint: "low · elderly · JKT → G1" },
  { nik: "3201010101010001", hint: "low · head of family · JKT → G2" },
  { nik: "3201010101010004", hint: "medium · JKT → G3" },
  { nik: "9999000000000001", hint: "high income → rejected" },
];

export default function RecipientConsole() {
  const [nik, setNik] = useState("");
  const [att, setAtt] = useState<AttestResult | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestAttestation(value?: string) {
    const useNik = value ?? nik;
    setBusy(true);
    setApplyMsg(null);
    setAtt(null);
    try {
      const res = await fetch("/api/issuer/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nik: useNik }),
      });
      const data: AttestResult = await res.json();
      setAtt(data);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!att?.ok || !att.preview?.eligible) return;
    setBusy(true);
    try {
      const res = await fetch("/api/recipient/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient_did: att.recipient_did,
          attributes: att.attributes,
          attestations: att.attestations,
        }),
      });
      const data = await res.json();
      setApplyMsg(data.ok ? "✓ Application submitted — pending operator approval." : `✗ ${data.reason}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionLabel n="R" title="Apply for social aid" sub="Prove identity · no file upload" />

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
            Request attestation
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
          {/* Certificate card */}
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
                    issuer · {a.issuer === "tax" ? "Tax Office" : "Civil Registry"}
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
          </div>

          {/* Eligibility preview */}
          <div className="rounded-xl border border-line bg-vault-900/60 p-6">
            <div className="font-display text-lg text-ink">Eligibility preview</div>
            <p className="mt-1 text-sm text-ink-dim">Instant — computed from attested attributes. Binding result requires operator approval.</p>
            {att.preview?.eligible ? (
              <div className="mt-5 rounded-lg border border-seal/40 bg-seal/10 p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-seal">looks eligible</div>
                <div className="mt-1 font-display text-3xl text-seal">{att.preview.tier}</div>
                <div className="font-mono text-sm text-ink">{rupiah(att.preview.amount ?? 0)}</div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-alert/40 bg-alert/10 p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-alert">not eligible</div>
                <div className="mt-1 font-mono text-sm text-ink-dim">{att.preview?.reason}</div>
              </div>
            )}
            <button
              onClick={apply}
              disabled={busy || !att.preview?.eligible}
              className="mt-5 w-full rounded-lg border border-seal/40 bg-seal/15 px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:opacity-40"
            >
              Apply
            </button>
            {applyMsg && <div className="mt-3 font-mono text-sm text-ink-dim">{applyMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
