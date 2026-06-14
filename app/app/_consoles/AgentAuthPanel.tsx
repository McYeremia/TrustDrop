"use client";

import { useCallback, useEffect, useState } from "react";
import { shortDid } from "@/app/_ui/primitives";

interface AuthState {
  authorized: boolean;
  agentDid: string;
  operatorDid: string;
  scriptName: string;
  functions: string[];
  allowedHosts: string[];
  grantedAt: string;
  selfGrant?: boolean;
}

export default function AgentAuthPanel({
  onChange,
}: {
  onChange?: (authorized: boolean) => void;
}) {
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/authorize", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setState(data);
        onChange?.(!!data.authorized);
      } else {
        setError(data.error ?? "Failed to load delegation state");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function authorize() {
    setGranting(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/authorize", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setState(data);
        onChange?.(true);
      } else {
        setError(data.error ?? "Grant failed");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGranting(false);
    }
  }

  const authorized = !!state?.authorized;

  return (
    <div
      className="mb-4 rounded-xl border p-5"
      style={{
        borderColor: authorized ? "rgba(47,211,165,0.3)" : "rgba(255,255,255,0.1)",
        background: authorized ? "rgba(47,211,165,0.04)" : "rgba(255,255,255,0.02)",
      }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg border"
            style={{
              borderColor: authorized ? "rgba(47,211,165,0.4)" : "rgba(255,255,255,0.12)",
              background: authorized ? "rgba(47,211,165,0.1)" : "rgba(255,255,255,0.04)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={authorized ? "#2fd3a5" : "#888"} strokeWidth="1.3" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke={authorized ? "#2fd3a5" : "#888"} strokeWidth="1.3" />
            </svg>
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-white">Agent Auth · delegation</div>
            <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#777" }}>
              Operator grants scoped authority — agent never holds the key
            </div>
          </div>
        </div>

        {authorized ? (
          <span className="flex items-center gap-1.5 rounded-full border border-seal/40 bg-seal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-seal">
            <span className="size-1.5 rounded-full bg-seal seal-pulse" /> Delegation active
          </span>
        ) : (
          <button
            onClick={authorize}
            disabled={granting || loading}
            className="gold-btn rounded-lg px-4 py-2 text-sm font-bold tracking-wide disabled:opacity-40"
          >
            {granting ? "Signing grant…" : "Authorize agent"}
          </button>
        )}
      </div>

      {/* Delegation detail */}
      {state && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* Identity flow */}
          <div className="rounded-lg border border-line bg-vault-950/50 p-3 font-mono text-xs">
            <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>
              Delegation
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-dim">{shortDid(state.operatorDid)}</span>
              <span className="text-[10px] text-ink-faint">operator</span>
            </div>
            <div className="my-1 flex items-center gap-1.5" style={{ color: "#555" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px]">grants authority to</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={state.selfGrant ? "text-ink-dim" : "text-seal"}>
                {shortDid(state.agentDid)}
              </span>
              <span className="text-[10px] text-ink-faint">
                agent{state.selfGrant ? " (self-grant)" : " · own DID"}
              </span>
            </div>
          </div>

          {/* Scope */}
          <div className="rounded-lg border border-line bg-vault-950/50 p-3 font-mono text-xs">
            <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>
              Scoped to
            </div>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {state.functions.map((f) => (
                <span key={f} className="rounded border border-seal/30 bg-seal/5 px-1.5 py-0.5 text-[10px] text-seal">
                  {f}
                </span>
              ))}
            </div>
            <div className="text-ink-faint">
              host:{" "}
              <span className="text-ink-dim">{state.allowedHosts.join(", ") || "—"}</span>
            </div>
            <div className="mt-1 truncate text-ink-faint" title={state.scriptName}>
              contract: <span className="text-ink-dim">{state.scriptName}</span>
            </div>
          </div>
        </div>
      )}

      {!authorized && !loading && (
        <p className="mt-3 text-xs" style={{ color: "#777" }}>
          The AI agent below stays locked until the operator signs this grant. This is the T3 Agent
          Auth model: the agent acts on delegated, revocable authority — it can never exceed these functions or
          reach any other host.
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-alert/40 bg-alert/10 p-3 font-mono text-xs text-alert">
          {error}
        </div>
      )}
    </div>
  );
}
