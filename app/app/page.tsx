"use client";

import { useState } from "react";
import Link from "next/link";
import RecipientConsole from "./_consoles/RecipientConsole";
import OperatorConsole from "./_consoles/OperatorConsole";
import AuditorConsole from "./_consoles/AuditorConsole";

type Role = "recipient" | "operator" | "auditor";

const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: "recipient", label: "Recipient", blurb: "Prove identity, apply, see your aid" },
  { id: "operator", label: "Operator", blurb: "Approve eligibility, disburse — no PII" },
  { id: "auditor", label: "Auditor", blurb: "Public, immutable, PII-free ledger" },
];

export default function ConsolePage() {
  const [role, setRole] = useState<Role>("recipient");

  return (
    <div className="grain relative min-h-full overflow-x-hidden">
      <div className="vault-grid pointer-events-none absolute inset-0 h-[300px]" />

      <header className="relative z-10 flex items-center justify-between border-b border-line/70 px-6 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative grid size-9 place-items-center rounded-md border border-seal/40 bg-seal/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" stroke="var(--seal)" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8.5 12l2.5 2.5 4.5-5" stroke="var(--seal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight text-ink">TrustDrop</div>
            <div className="text-[10px] uppercase tracking-engrave text-ink-faint">Console</div>
          </div>
        </Link>
        <Link href="/" className="font-mono text-[11px] uppercase tracking-wider text-ink-dim transition hover:text-ink">
          ← back to overview
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:px-10">
        {/* Role switcher */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-seal/50 bg-seal/10"
                    : "border-line bg-vault-900/50 hover:border-line-soft"
                }`}
              >
                <div className={`font-display text-lg ${active ? "text-seal" : "text-ink"}`}>{r.label}</div>
                <div className="mt-0.5 text-xs text-ink-dim">{r.blurb}</div>
              </button>
            );
          })}
        </div>

        {role === "recipient" && <RecipientConsole />}
        {role === "operator" && <OperatorConsole />}
        {role === "auditor" && <AuditorConsole />}
      </div>
    </div>
  );
}
