"use client";

import { useEffect, useState, useCallback } from "react";
import { rupiah, shortDid, SectionLabel } from "@/app/_ui/primitives";

interface Application {
  recipient_did: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  tier: string;
  amount: number;
  issuers: string[];
  status: "pending" | "approved" | "rejected";
}

export default function OperatorConsole() {
  const [apps, setApps] = useState<Application[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ did: string; text: string; ok: boolean }[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/applications", { cache: "no-store" });
    const data = await res.json();
    setApps(data.applications ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  function pushLog(did: string, text: string, ok: boolean) {
    setLog((l) => [{ did, text, ok }, ...l].slice(0, 8));
  }

  async function decide(did: string, decision: "approve" | "reject") {
    setBusy(did + decision);
    try {
      const res = await fetch("/api/operator/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: did, decision }),
      });
      const data = await res.json();
      pushLog(did, data.ok ? `decision: ${data.status}` : `decision failed: ${data.reason ?? "error"}`, !!data.ok);
      await load();
    } catch (e) {
      pushLog(did, `decision error: ${(e as Error).message}`, false);
    } finally {
      setBusy(null);
    }
  }

  async function callContract(did: string, path: string, body: object, label: string) {
    setBusy(did + label);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      pushLog(did, `${label}: ${JSON.stringify(data.result ?? data)}`, res.ok && data.ok !== false);
    } catch (e) {
      pushLog(did, `${label} error: ${(e as Error).message}`, false);
    } finally {
      setBusy(null);
    }
  }

  const pending = apps.filter((a) => a.status === "pending");
  const approved = apps.filter((a) => a.status === "approved");

  return (
    <div>
      <SectionLabel n="O" title="Eligibility approvals" sub="Attested attributes only — no PII" />

      {/* Pending queue */}
      <div className="rounded-xl border border-line bg-vault-900/60 p-5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          pending applications · {pending.length}
        </div>
        {pending.length === 0 ? (
          <p className="py-6 text-center font-mono text-sm text-ink-faint">No pending applications.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.recipient_did} className="rounded-lg border border-line-soft bg-vault-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-sm text-ink-dim">{shortDid(a.recipient_did)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(a.recipient_did, "approve")}
                      disabled={busy !== null}
                      className="rounded-lg border border-seal/40 bg-seal/15 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(a.recipient_did, "reject")}
                      disabled={busy !== null}
                      className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-alert transition hover:bg-alert/20 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge text={`income=${a.income_bracket}`} issuer="Tax Office" />
                  <Badge text={`region=${a.region_code}`} issuer="Civil Registry" />
                  <Badge text={`household=${a.household_status}`} issuer="Civil Registry" />
                  <span className="rounded border border-seal/30 bg-seal/5 px-2 py-0.5 font-mono text-[11px] text-seal">
                    {a.tier} · {rupiah(a.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved → contract actions */}
      <div className="mt-6 rounded-xl border border-line bg-vault-900/60 p-5">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          approved · {approved.length}
        </div>
        <p className="mb-3 text-xs text-ink-dim">
          check-eligibility & prepare-batch call the live contract. Disburse pays the provider (the enclave resolves the name; you never see it).
        </p>
        {approved.length === 0 ? (
          <p className="py-6 text-center font-mono text-sm text-ink-faint">Nothing approved yet.</p>
        ) : (
          <div className="space-y-3">
            {approved.map((a) => (
              <div key={a.recipient_did} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft bg-vault-950/50 p-4">
                <div className="font-mono text-sm text-ink-dim">
                  {shortDid(a.recipient_did)} · <span className="text-seal">{a.tier}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionBtn label="Check eligibility" busy={busy === a.recipient_did + "Check eligibility"}
                    onClick={() => callContract(a.recipient_did, "/api/contract/check-eligibility", { recipient_did: a.recipient_did }, "Check eligibility")} />
                  <ActionBtn label="Prepare batch" busy={busy === a.recipient_did + "Prepare batch"}
                    onClick={() => callContract(a.recipient_did, "/api/contract/prepare-batch", {}, "Prepare batch")} />
                  <ActionBtn label="Disburse" accent busy={busy === a.recipient_did + "Disburse"}
                    onClick={() => callContract(a.recipient_did, "/api/contract/disburse", { recipient_did: a.recipient_did, amount: a.amount, tier: a.tier }, "Disburse")} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result log */}
      {log.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-vault-950/60 p-5">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">result log</div>
          <div className="space-y-1.5">
            {log.map((l, i) => (
              <div key={i} className="font-mono text-xs">
                <span className={l.ok ? "text-seal" : "text-alert"}>{l.ok ? "✓" : "✗"}</span>{" "}
                <span className="text-ink-faint">{shortDid(l.did)}</span>{" "}
                <span className="text-ink-dim break-all">{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, issuer }: { text: string; issuer: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-line bg-vault-850 px-2 py-0.5 font-mono text-[11px] text-ink-dim">
      <span className="text-seal">✓</span> {text} <span className="text-ink-faint">· {issuer}</span>
    </span>
  );
}

function ActionBtn({ label, onClick, busy, accent }: { label: string; onClick: () => void; busy: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition disabled:opacity-40 ${
        accent
          ? "border-pii/40 bg-pii/10 text-pii hover:bg-pii/20"
          : "border-line bg-vault-850 text-ink-dim hover:text-ink"
      }`}
    >
      {busy ? "…" : label}
    </button>
  );
}
