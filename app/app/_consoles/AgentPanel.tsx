"use client";

import { useState } from "react";
import { rupiah, shortDid } from "@/app/_ui/primitives";

interface ToolStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}
interface Planned {
  recipient_did: string;
  program_id: string;
  program_name: string;
  amount: number;
  tier: string;
}
interface AgentResult {
  transcript: ToolStep[];
  summary: string;
  planned: Planned[];
}
interface Executed {
  recipient_did: string;
  program_id: string;
  status: string;
  tx_id?: string;
  error?: string;
}

const EXAMPLES = [
  "Disburse aid to all eligible applicants in Jakarta",
  "Approve and pay everyone who qualifies",
  "Review pending applications and tell me who is eligible",
];

const TOOL_LABEL: Record<string, string> = {
  list_pending_applications: "List pending applications",
  list_all_applications: "List all applications",
  approve_application: "Approve",
  reject_application: "Reject",
  check_eligibility: "Check eligibility (TEE)",
  disburse: "Plan disbursement",
  get_audit_summary: "Read audit ledger",
};

export default function AgentPanel({
  onDisbursed,
  authorized = true,
}: {
  onDisbursed?: () => void;
  authorized?: boolean;
}) {
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<Executed[] | null>(null);

  async function run() {
    if (!command.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setExecuted(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Agent failed");
      else setResult({ transcript: data.transcript, summary: data.summary, planned: data.planned });
      onDisbursed?.(); // approvals may have changed the queue
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisburse() {
    if (!result?.planned.length) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmDisburse: result.planned.map((p) => ({
            recipient_did: p.recipient_did,
            program_id: p.program_id,
          })),
        }),
      });
      const data = await res.json();
      setExecuted(data.executed ?? []);
      onDisbursed?.();
    } finally {
      setExecuting(false);
    }
  }

  const plannedTotal = result?.planned.reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <div
      className="mb-6 rounded-xl border p-5"
      style={{
        borderColor: authorized ? "rgba(240,169,59,0.2)" : "rgba(255,255,255,0.08)",
        background: authorized ? "rgba(240,169,59,0.03)" : "rgba(255,255,255,0.015)",
        opacity: authorized ? 1 : 0.55,
        pointerEvents: authorized ? "auto" : "none",
      }}
      aria-disabled={!authorized}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex size-8 items-center justify-center rounded-lg border"
          style={{ borderColor: "rgba(240,169,59,0.3)", background: "rgba(240,169,59,0.08)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5l1.6 3.3L13 5.3l-2.5 2.4.6 3.4L8 9.5l-3.1 1.6.6-3.4L3 5.3l3.4-.5L8 1.5z" stroke="#f0a93b" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white">AI Disbursement Agent</span>
            {!authorized && (
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>
                🔒 locked — authorize above
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#777" }}>
            Groq llama-3.3-70b · outside the TEE · never sees PII
          </div>
        </div>
      </div>

      {/* Command box */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && run()}
          placeholder="Tell the agent what to do, in plain language…"
          className="flex-1 rounded-lg border border-line bg-vault-950 px-3 py-2.5 text-sm text-ink outline-none focus:border-seal/50"
        />
        <button
          onClick={run}
          disabled={busy || !command.trim()}
          className="gold-btn rounded-lg px-5 py-2.5 text-sm font-bold tracking-wide disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Run agent"}
        </button>
      </div>

      {/* Examples */}
      {!result && !busy && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setCommand(ex)}
              className="rounded-full border border-line bg-vault-850 px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-alert/40 bg-alert/10 p-3 font-mono text-xs text-alert">
          {error}
        </div>
      )}

      {/* Transcript */}
      {result && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>
              Agent actions · what flowed through the LLM (no PII)
            </div>
            <div className="space-y-1.5">
              {result.transcript.map((step, i) => (
                <TranscriptRow key={i} step={step} />
              ))}
              {result.transcript.length === 0 && (
                <div className="font-mono text-xs" style={{ color: "#666" }}>
                  No tool calls — the agent answered directly.
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="rounded-lg border border-line bg-vault-950/60 p-4">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-seal">
                Agent summary
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">{result.summary}</p>
            </div>
          )}

          {/* Confirmation gate */}
          {result.planned.length > 0 && !executed && (
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "rgba(240,169,59,0.4)", background: "rgba(240,169,59,0.06)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-seal">
                  ⏸ Human confirmation required
                </span>
              </div>
              <p className="mb-3 text-sm text-ink-dim">
                The agent planned <span className="font-bold text-white">{result.planned.length}</span>{" "}
                disbursement{result.planned.length > 1 ? "s" : ""} totalling{" "}
                <span className="font-bold text-seal">{rupiah(plannedTotal)}</span>. Money moves only after you confirm.
              </p>
              <div className="mb-3 space-y-1">
                {result.planned.map((p) => (
                  <div key={p.recipient_did + p.program_id} className="flex justify-between font-mono text-xs">
                    <span className="text-ink-faint">{p.program_name} · {shortDid(p.recipient_did)} · {p.tier}</span>
                    <span className="text-ink">{rupiah(p.amount)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={confirmDisburse}
                disabled={executing}
                className="gold-btn rounded-lg px-5 py-2.5 text-sm font-bold tracking-wide disabled:opacity-40"
              >
                {executing ? "Disbursing…" : `Confirm & disburse ${result.planned.length}`}
              </button>
            </div>
          )}

          {/* Execution results */}
          {executed && (
            <div className="rounded-lg border border-seal/40 bg-seal/10 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-seal">
                ✓ Disbursed · {executed.filter((e) => e.status === "SUCCESS").length}/{executed.length} succeeded
              </div>
              <div className="space-y-1">
                {executed.map((e) => (
                  <div key={e.recipient_did + e.program_id} className="flex justify-between font-mono text-xs">
                    <span className="text-ink-faint">{shortDid(e.recipient_did)}</span>
                    <span className={e.status === "SUCCESS" ? "text-seal" : "text-alert"}>
                      {e.status} {e.tx_id ? `· ${e.tx_id}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptRow({ step }: { step: ToolStep }) {
  const label = TOOL_LABEL[step.tool] ?? step.tool;
  const did = step.args.recipient_did ? shortDid(String(step.args.recipient_did)) : null;
  const summary = summariseResult(step.tool, step.result);
  const ok = !(step.result && typeof step.result === "object" && "error" in (step.result as object));

  return (
    <div className="flex items-start gap-2 rounded-lg bg-vault-950/40 px-3 py-2 font-mono text-xs">
      <span className={ok ? "text-seal" : "text-alert"}>{ok ? "✓" : "✗"}</span>
      <span className="font-bold text-ink">{label}</span>
      {did && <span className="text-ink-faint">{did}</span>}
      <span className="ml-auto truncate text-right" style={{ color: "#777", maxWidth: "55%" }}>
        {summary}
      </span>
    </div>
  );
}

function summariseResult(tool: string, result: unknown): string {
  if (Array.isArray(result)) return `${result.length} record${result.length === 1 ? "" : "s"}`;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if ("error" in r) return String(r.error);
    if (tool === "check_eligibility") return r.eligible ? "eligible ✓" : `not eligible (${r.reason_code ?? "—"})`;
    if (tool === "disburse") return `${r.status} · ${r.tier ?? ""}`;
    if (tool === "approve_application" || tool === "reject_application") return String(r.status ?? "");
    if (tool === "get_audit_summary") return `${r.disbursements} disbursed`;
    return Object.keys(r).slice(0, 2).map((k) => `${k}=${r[k]}`).join(" ");
  }
  return String(result ?? "");
}
