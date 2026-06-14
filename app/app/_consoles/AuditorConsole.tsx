"use client";

import { useEffect, useState, useCallback } from "react";
import { rupiah, shortDid, SectionLabel } from "@/app/_ui/primitives";

interface Decision {
  recipient_did: string;
  status: string;
  tier: string;
  decided_by?: string;
  decided_at?: string;
  issuers: string[];
}
interface Disbursement {
  recipient_did: string;
  tx_id: string;
  amount: number;
  period: string;
  received_at: string;
}

export default function AuditorConsole() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/audit", { cache: "no-store" });
    const data = await res.json();
    setDecisions(data.decisions ?? []);
    setDisbursements(data.disbursements ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <SectionLabel n="A" title="Public audit ledger" sub="Immutable · refreshed every 2.5s" />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-seal/30 bg-seal/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-seal">
        <span className="size-1.5 rounded-full bg-seal" /> No PII in this ledger
      </div>

      {/* Decisions */}
      <div className="overflow-hidden rounded-xl border border-line bg-vault-900/50">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr_1.4fr] gap-3 border-b border-line/70 bg-vault-850 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          <span>recipient_did</span><span>status</span><span>tier</span><span>issuers</span>
        </div>
        {decisions.length === 0 ? (
          <p className="py-8 text-center font-mono text-sm text-ink-faint">No decisions yet.</p>
        ) : (
          decisions.map((d) => (
            <div key={d.recipient_did} className="grid grid-cols-[1.4fr_0.8fr_0.6fr_1.4fr] items-center gap-3 border-b border-line-soft px-5 py-3 font-mono text-sm last:border-0">
              <span className="truncate text-ink-dim">{shortDid(d.recipient_did)}</span>
              <span className={d.status === "approved" ? "text-seal" : d.status === "rejected" ? "text-alert" : "text-ink-dim"}>{d.status}</span>
              <span className="text-ink">{d.tier || "—"}</span>
              <span className="truncate text-ink-faint">{d.issuers?.join(", ") || "—"}</span>
            </div>
          ))
        )}
      </div>

      {/* Disbursements */}
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-vault-900/50">
        <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr] gap-3 border-b border-line/70 bg-vault-850 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          <span>recipient_did</span><span>tx_id</span><span>amount</span><span className="text-right">received_at</span>
        </div>
        {disbursements.length === 0 ? (
          <p className="py-8 text-center font-mono text-sm text-ink-faint">No disbursements yet.</p>
        ) : (
          disbursements.map((d) => (
            <div key={d.tx_id} className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr] items-center gap-3 border-b border-line-soft px-5 py-3 font-mono text-sm last:border-0">
              <span className="truncate text-ink-dim">{shortDid(d.recipient_did)}</span>
              <span className="truncate text-ink-dim">{d.tx_id}</span>
              <span className="text-ink">{rupiah(d.amount)}</span>
              <span className="truncate text-right text-ink-faint">{new Date(d.received_at).toLocaleTimeString("en-US")}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
