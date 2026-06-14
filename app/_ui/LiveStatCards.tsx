"use client";

import { useEffect, useState } from "react";
import { rupiahCompact } from "./primitives";

interface Audit {
  decisions?: { status: string }[];
  disbursements?: { amount: number }[];
}

export function LiveStatCards() {
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
    const t = setInterval(load, 5000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  const disbursements = data.disbursements ?? [];
  const decisions = data.decisions ?? [];
  const total = disbursements.reduce((s, d) => s + (d.amount || 0), 0);
  const approved = decisions.filter((d) => d.status === "approved").length;

  const stats = [
    {
      v: disbursements.length > 0 ? String(disbursements.length) : "—",
      label: "Aid Disbursed",
      sub: "Successful transfers on testnet",
      live: true,
    },
    {
      v: "0 PII",
      label: "Leaks to Agent",
      sub: "Identity sealed in enclave always",
      live: false,
    },
    {
      v: total > 0 ? rupiahCompact(total) : "—",
      label: "Total Transferred",
      sub: "Cumulative aid on testnet",
      live: true,
    },
    {
      v: approved > 0 ? String(approved) : "—",
      label: "Eligibility Approvals",
      sub: "Operator-verified recipients",
      live: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:col-span-2">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="reveal dark-stat-card rounded-2xl p-6 sm:p-8"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="gold-shine text-3xl font-black tracking-tight sm:text-4xl">
              {stat.v}
            </div>
            {stat.live && (
              <span
                className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                style={{
                  borderColor: "rgba(240,169,59,0.25)",
                  background: "rgba(240,169,59,0.06)",
                  color: "var(--seal)",
                }}
              >
                <span className="size-1 rounded-full bg-seal seal-pulse" />
                live
              </span>
            )}
          </div>
          <div className="mt-3 text-sm font-bold text-white">{stat.label}</div>
          <div className="mt-1 text-xs" style={{ color: "#666" }}>
            {stat.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
