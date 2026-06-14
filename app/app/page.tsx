"use client";

import { useState } from "react";
import { SiteNav } from "@/app/_ui/SiteNav";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import RecipientConsole from "./_consoles/RecipientConsole";
import OperatorConsole from "./_consoles/OperatorConsole";
import AuditorConsole from "./_consoles/AuditorConsole";

type Role = "recipient" | "operator" | "auditor";

const ROLES: {
  id: Role;
  num: string;
  label: string;
  sub: string;
  description: string;
  caps: string[];
  badge: string;
  badgeColor: string;
  accent: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "recipient",
    num: "01",
    label: "Recipient",
    sub: "Warga · Citizen",
    description:
      "Prove your identity via issuer attestation, check eligibility, and submit an aid application — no file uploads, no PII handed to anyone.",
    caps: [
      "Request attestation from Tax Office & Civil Registry",
      "See tier & amount before you apply",
      "Submit application sealed inside the enclave",
    ],
    badge: "Privacy-first",
    badgeColor: "rgba(240,169,59,0.15)",
    accent: "#f0a93b",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="14" r="7" stroke="#f0a93b" strokeWidth="1.8" />
        <path
          d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14"
          stroke="#f0a93b"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M28 10l2 2 4-4"
          stroke="#f0a93b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "operator",
    num: "02",
    label: "Operator",
    sub: "Lembaga · Institution",
    description:
      "Review attested eligibility data — not raw PII — and trigger disbursements. The enclave resolves identity; you only approve the policy.",
    caps: [
      "Review pending applications (attested attributes only)",
      "Approve or reject based on verified claims",
      "Trigger disbursement — name stays in enclave",
    ],
    badge: "Zero PII",
    badgeColor: "rgba(232,101,79,0.12)",
    accent: "#e8654f",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="10" width="28" height="22" rx="3" stroke="#e8654f" strokeWidth="1.8" />
        <path d="M13 10V7a7 7 0 0114 0v3" stroke="#e8654f" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="20" cy="22" r="3" stroke="#e8654f" strokeWidth="1.8" />
        <path d="M20 25v4" stroke="#e8654f" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "auditor",
    num: "03",
    label: "Auditor",
    sub: "Publik · Public",
    description:
      "Read the immutable, public ledger of every decision and disbursement. Fully verifiable — and completely free of citizen PII.",
    caps: [
      "Browse approval & rejection decisions",
      "Verify disbursement amounts and tx IDs",
      "Confirm zero PII appears in any entry",
    ],
    badge: "Public ledger",
    badgeColor: "rgba(100,180,255,0.12)",
    accent: "#64b4ff",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="10" y="6" width="20" height="28" rx="3" stroke="#64b4ff" strokeWidth="1.8" />
        <line x1="15" y1="14" x2="25" y2="14" stroke="#64b4ff" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="15" y1="20" x2="25" y2="20" stroke="#64b4ff" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="15" y1="26" x2="21" y2="26" stroke="#64b4ff" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M23 24l2 2 4-4" stroke="#64b4ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function ConsolePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [entering, setEntering] = useState(false);

  function enter(r: Role) {
    setEntering(true);
    setTimeout(() => {
      setRole(r);
      setEntering(false);
    }, 320);
  }

  function back() {
    setEntering(true);
    setTimeout(() => {
      setRole(null);
      setEntering(false);
    }, 280);
  }

  const activeRole = role ? ROLES.find((r) => r.id === role)! : null;

  return (
    <div
      className="grain relative min-h-screen overflow-x-hidden"
      style={{ background: "#080808" }}
    >
      {/* Gold grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 top-14"
        style={{
          height: 300,
          backgroundImage:
            "linear-gradient(to right, rgba(240,169,59,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(240,169,59,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
          maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
        }}
      />

      {/* Ambient gold glow */}
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

      <SiteNav />

      <div
        className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-20 sm:px-10 sm:pt-24"
        style={{
          opacity: entering ? 0 : 1,
          transform: entering ? "translateY(10px)" : "translateY(0)",
          transition: "opacity 0.28s ease, transform 0.28s ease",
        }}
      >
        {/* ── ROLE SELECTION ──────────────────────────────────────── */}
        {!role && (
          <div>
            {/* Header */}
            <div className="mb-12 max-w-xl">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-seal">
                TrustDrop Console
              </span>
              <h1 className="mt-3 text-4xl font-black leading-[1.0] tracking-tighter text-white sm:text-5xl">
                Who are
                <br />
                <span className="gold-shine gold-glow">you today?</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed sm:text-base" style={{ color: "#888" }}>
                Pick a role to enter. Each actor sees only what they need — nothing more.
              </p>
            </div>

            {/* Flow guide */}
            <div className="mb-8 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3" style={{ borderColor: "rgba(240,169,59,0.15)", background: "rgba(240,169,59,0.04)" }}>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>Recommended flow</span>
              <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)", minWidth: 12 }} />
              {ROLES.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  {i > 0 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6h6M7 4l2 2-2 2" stroke="#444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <button
                    onClick={() => enter(r.id)}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] transition hover:bg-white/5"
                    style={{ color: r.accent }}
                  >
                    <span className="opacity-50">{r.num}</span> {r.label}
                  </button>
                </div>
              ))}
            </div>

            {/* Role cards */}
            <div className="grid gap-5 md:grid-cols-3">
              {ROLES.map((r, i) => (
                <RoleCard
                  key={r.id}
                  role={r}
                  delay={i * 80}
                  onEnter={() => enter(r.id)}
                />
              ))}
            </div>

            {/* Footer hint */}
            <p
              className="mt-10 text-center font-mono text-[11px] uppercase tracking-wider"
              style={{ color: "#444" }}
            >
              No login required · demo mode · data resets on server restart
            </p>
          </div>
        )}

        {/* ── CONSOLE VIEW ────────────────────────────────────────── */}
        {role && activeRole && (
          <div>
            {/* Console header */}
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <button
                  onClick={back}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition hover:border-white/20 hover:text-white"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#666" }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Change role
                </button>
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: `${activeRole.accent}33`,
                      background: `${activeRole.accent}12`,
                    }}
                  >
                    {activeRole.icon}
                  </div>
                  <div>
                    <div
                      className="font-mono text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: activeRole.accent }}
                    >
                      {activeRole.num} · {activeRole.sub}
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {activeRole.label} Console
                    </h1>
                  </div>
                </div>
              </div>

              {/* Live role badge */}
              <div
                className="hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider sm:flex"
                style={{
                  borderColor: `${activeRole.accent}33`,
                  background: `${activeRole.accent}10`,
                  color: activeRole.accent,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: activeRole.accent }}
                />
                {activeRole.badge}
              </div>
            </div>

            {/* Console panel */}
            <div
              className="rounded-2xl border p-1"
              style={{
                borderColor: `${activeRole.accent}20`,
                background: `${activeRole.accent}05`,
              }}
            >
              <div className="rounded-xl p-5 sm:p-6">
                {role === "recipient" && <RecipientConsole />}
                {role === "operator" && <OperatorConsole onSwitchToRecipient={() => enter("recipient")} />}
                {role === "auditor" && <AuditorConsole />}
              </div>
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

/* ── Role card ─────────────────────────────────────────────────────────── */

function RoleCard({
  role,
  delay,
  onEnter,
}: {
  role: (typeof ROLES)[number];
  delay: number;
  onEnter: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="reveal group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-7 transition-all duration-300"
      style={{
        animationDelay: `${delay}ms`,
        borderColor: hovered ? `${role.accent}55` : "rgba(255,255,255,0.07)",
        background: hovered
          ? `linear-gradient(160deg, ${role.accent}0d, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.025)",
        boxShadow: hovered ? `0 0 40px ${role.accent}18` : "none",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEnter}
    >
      {/* Number + Badge row */}
      <div className="mb-5 flex items-center justify-between">
        <span
          className="font-mono text-4xl font-black leading-none"
          style={{ color: hovered ? role.accent : "rgba(255,255,255,0.08)", transition: "color 0.3s" }}
        >
          {role.num}
        </span>
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{ background: role.badgeColor, color: role.accent }}
        >
          {role.badge}
        </span>
      </div>

      {/* Icon */}
      <div
        className="mb-4 flex size-12 items-center justify-center rounded-xl border"
        style={{
          borderColor: `${role.accent}30`,
          background: `${role.accent}0d`,
          transition: "background 0.3s, box-shadow 0.3s",
          boxShadow: hovered ? `0 0 20px ${role.accent}22` : "none",
        }}
      >
        {role.icon}
      </div>

      {/* Label + sub */}
      <div className="mb-1">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: role.accent, opacity: 0.8 }}
        >
          {role.sub}
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">{role.label}</h2>
      </div>

      {/* Description */}
      <p className="mb-5 text-sm leading-relaxed" style={{ color: "#777" }}>
        {role.description}
      </p>

      {/* Capabilities */}
      <ul className="mb-7 space-y-2">
        {role.caps.map((cap) => (
          <li key={cap} className="flex items-start gap-2 font-mono text-[11px]" style={{ color: "#666" }}>
            <span style={{ color: role.accent, flexShrink: 0, marginTop: 1 }}>›</span>
            {cap}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto">
        <div
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-mono text-sm font-bold uppercase tracking-wide transition-all duration-200"
          style={{
            borderColor: hovered ? role.accent : `${role.accent}44`,
            background: hovered ? `${role.accent}22` : `${role.accent}0d`,
            color: role.accent,
          }}
        >
          Enter as {role.label}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: "transform 0.2s", transform: hovered ? "translateX(3px)" : "translateX(0)" }}>
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Corner accent line */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-16 w-px"
        style={{
          background: `linear-gradient(to bottom, ${role.accent}55, transparent)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-px w-16"
        style={{
          background: `linear-gradient(to left, ${role.accent}55, transparent)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />
    </div>
  );
}
