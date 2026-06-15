"use client";

import { useEffect, useState, useCallback } from "react";
import { rupiah, shortDid, SectionLabel } from "@/app/_ui/primitives";
import AgentPanel from "./AgentPanel";
import AgentAuthPanel from "./AgentAuthPanel";

interface Application {
  recipient_did: string;
  program_id: string;
  program_name: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  tier: string;
  amount: number;
  eligible: boolean;
  reason?: string;
  issuers: string[];
  status: "pending" | "approved" | "rejected";
  disbursed_at?: string;
  tx_id?: string;
}

export default function OperatorConsole({ onSwitchToRecipient }: { onSwitchToRecipient?: () => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ did: string; text: string; ok: boolean }[]>([]);
  const [authorized, setAuthorized] = useState(false);

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

  async function resetDemo() {
    if (!confirm("Clear all applications and the provider ledger? (on-chain contract is untouched)")) return;
    setBusy("reset");
    try {
      await fetch("/api/admin/reset", { method: "POST" });
      setLog([]);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function decide(did: string, program_id: string, decision: "approve" | "reject") {
    setBusy(did + program_id + decision);
    try {
      const res = await fetch("/api/operator/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: did, program_id, decision }),
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

  async function callContract(busyKey: string, did: string, path: string, body: object, label: string) {
    setBusy(busyKey);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const src = data.source === "system" ? " · system match (TEE skipped — no testnet credit)"
        : data.source === "tee" ? " · live TEE" : "";
      pushLog(did, `${label}: ${JSON.stringify(data.result ?? data)}${src}`, res.ok && data.ok !== false);
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
      <div className="flex items-center justify-between gap-3">
        <SectionLabel n="O" title="Eligibility approvals" sub="Attested attributes only — no PII" />
      </div>
      <div className="-mt-3 mb-4 flex justify-end">
        <button
          onClick={resetDemo}
          disabled={busy !== null}
          className="rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-faint transition hover:text-alert disabled:opacity-40"
        >
          ⟲ Reset demo data
        </button>
      </div>

      {/* Agent Auth delegation + AI agent */}
      <AgentAuthPanel onChange={setAuthorized} />
      <AgentPanel onDisbursed={load} authorized={authorized} />

      {/* Pending queue */}
      <div className="rounded-xl border border-line bg-vault-900/60 p-5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          pending applications · {pending.length}
        </div>
        {pending.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-mono text-sm text-ink-faint">No pending applications yet.</p>
            <p className="mt-1 text-xs" style={{ color: "#555" }}>
              Someone needs to apply first —{" "}
              {onSwitchToRecipient ? (
                <button
                  onClick={onSwitchToRecipient}
                  className="font-mono text-seal underline-offset-2 hover:underline"
                >
                  switch to Recipient console
                </button>
              ) : (
                <span style={{ color: "#666" }}>go to the Recipient console</span>
              )}{" "}
              to submit an application.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.recipient_did + a.program_id} className="rounded-lg border border-line-soft bg-vault-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-ink">{a.program_name}</div>
                    <div className="font-mono text-[11px] text-ink-faint">{shortDid(a.recipient_did)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(a.recipient_did, a.program_id, "approve")}
                      disabled={busy !== null}
                      className="rounded-lg border border-seal/40 bg-seal/15 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-seal transition hover:bg-seal/25 disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(a.recipient_did, a.program_id, "reject")}
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
                  {a.eligible === false ? (
                    <span className="rounded border border-alert/40 bg-alert/10 px-2 py-0.5 font-mono text-[11px] text-alert">
                      policy: ineligible · {a.reason}
                    </span>
                  ) : (
                    <span className="rounded border border-seal/30 bg-seal/5 px-2 py-0.5 font-mono text-[11px] text-seal">
                      policy: {a.tier} · {rupiah(a.amount)}
                    </span>
                  )}
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
            {approved.map((a) => {
              const k = a.recipient_did + a.program_id;
              return (
              <div key={k} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft bg-vault-950/50 p-4">
                <div>
                  <div className="text-sm font-bold text-ink">{a.program_name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">
                    {shortDid(a.recipient_did)} · <span className="text-seal">{a.tier}</span> · {rupiah(a.amount)}
                  </div>
                  {a.disbursed_at && (
                    <div className="mt-1 font-mono text-[11px] text-seal">
                      ✓ paid · {a.tx_id}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionBtn label="Check eligibility" busy={busy === k + "Check eligibility"}
                    onClick={() => callContract(k + "Check eligibility", a.recipient_did, "/api/contract/check-eligibility", { recipient_did: a.recipient_did, program_id: a.program_id }, "Check eligibility")} />
                  <ActionBtn label="Prepare batch" busy={busy === k + "Prepare batch"}
                    onClick={() => callContract(k + "Prepare batch", a.recipient_did, "/api/contract/prepare-batch", { program_id: a.program_id }, "Prepare batch")} />
                  <ActionBtn label={a.disbursed_at ? "Disbursed" : "Disburse"} accent busy={busy === k + "Disburse"} disabled={!!a.disbursed_at}
                    onClick={() => callContract(k + "Disburse", a.recipient_did, "/api/contract/disburse", { recipient_did: a.recipient_did, program_id: a.program_id, amount: a.amount, tier: a.tier }, "Disburse")} />
                </div>
              </div>
              );
            })}
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

function ActionBtn({ label, onClick, busy, accent, disabled }: { label: string; onClick: () => void; busy: boolean; accent?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
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
