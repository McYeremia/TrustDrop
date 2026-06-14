"use client";

import { useEffect, useState } from "react";
import { rupiahCompact } from "./primitives";

interface Audit {
  decisions?: { status: string }[];
  disbursements?: { amount: number }[];
}

export function LiveStats() {
  const [data, setData] = useState<Audit>({});

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const r = await fetch("/api/audit", { cache: "no-store" });
        const j = await r.json();
        if (on) setData(j);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  const disbursed = data.disbursements ?? [];
  const total = disbursed.reduce((s, d) => s + (d.amount || 0), 0);
  const approvals = (data.decisions ?? []).filter((d) => d.status === "approved").length;

  const stats = [
    { v: String(disbursed.length), k: "Disbursements" },
    { v: rupiahCompact(total), k: "Total aid delivered" },
    { v: String(approvals), k: "Eligibility approvals" },
    { v: "0", k: "PII seen by the agent" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.k}
          className="glass glass-sheen reveal rounded-2xl p-6 text-center sm:p-8"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="text-2xl font-semibold tracking-tight text-seal sm:text-3xl">{s.v}</div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</div>
        </div>
      ))}
    </div>
  );
}
