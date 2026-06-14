"use client";

import { useState } from "react";
import { SiteNav } from "@/app/_ui/SiteNav";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import RecipientConsole from "./_consoles/RecipientConsole";
import OperatorConsole from "./_consoles/OperatorConsole";
import AuditorConsole from "./_consoles/AuditorConsole";

type Role = "recipient" | "operator" | "auditor";

const ROLES: { id: Role; label: string; blurb: string; icon: string }[] = [
  { id: "recipient", label: "Recipient", blurb: "Prove identity, apply, see your aid", icon: "👤" },
  { id: "operator", label: "Operator", blurb: "Approve eligibility, disburse — no PII", icon: "🏛" },
  { id: "auditor", label: "Auditor", blurb: "Public, immutable, PII-free ledger", icon: "📋" },
];

export default function ConsolePage() {
  const [role, setRole] = useState<Role>("recipient");

  return (
    <div
      className="grain relative min-h-screen overflow-x-hidden"
      style={{ background: "#080808" }}
    >
      <SiteNav />

      {/* Subtle gold grid pattern at top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 top-14"
        style={{
          height: 260,
          backgroundImage:
            "linear-gradient(to right, rgba(240,169,59,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(240,169,59,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
          maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
        }}
      />

      {/* Gold ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full"
        style={{
          width: 600,
          height: 300,
          background: "radial-gradient(ellipse, rgba(240,169,59,0.07), transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-10">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Console
          </span>
          <h1 className="mt-2 text-4xl font-black tracking-tighter text-white sm:text-5xl">
            Run the flow,{" "}
            <span className="gold-shine gold-glow">by role</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: "#7a7a7a" }}>
            Switch between the three actors. None of them — except the enclave
            at payment time — ever sees a citizen&rsquo;s PII.
          </p>
        </div>

        {/* Role switcher */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  active ? "dark-stat-card" : "dark-stat-card"
                }`}
                style={
                  active
                    ? {
                        borderColor: "rgba(240,169,59,0.45)",
                        background: "rgba(240,169,59,0.07)",
                        boxShadow: "0 0 24px rgba(240,169,59,0.1)",
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{r.icon}</span>
                  <div
                    className={`font-mono text-base font-bold ${
                      active ? "text-seal" : "text-white"
                    }`}
                  >
                    {r.label}
                  </div>
                </div>
                <div className="mt-1.5 text-xs" style={{ color: "#666" }}>
                  {r.blurb}
                </div>
              </button>
            );
          })}
        </div>

        {/* Console panels */}
        <div
          className="rounded-2xl border p-1"
          style={{ borderColor: "rgba(240,169,59,0.12)", background: "rgba(240,169,59,0.02)" }}
        >
          {role === "recipient" && <RecipientConsole />}
          {role === "operator" && <OperatorConsole />}
          {role === "auditor" && <AuditorConsole />}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
