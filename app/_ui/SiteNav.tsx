"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/demo", label: "Live demo" },
];

export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-xl"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(8,8,8,0.88)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-10">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <SealMark />
          <div className="leading-none">
            <div className="font-display text-base font-semibold tracking-tight text-ink">
              TrustDrop
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-engrave text-ink-faint">
              Verified Aid
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-wider transition ${
                  active ? "bg-vault-800 text-ink" : "text-ink-dim hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="rounded-full border border-seal/40 bg-seal/10 px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-wider text-seal transition hover:bg-seal/20"
          >
            Console →
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="flex size-9 items-center justify-center rounded-lg border transition md:hidden"
            style={{
              borderColor: open
                ? "rgba(240,169,59,0.3)"
                : "rgba(255,255,255,0.09)",
              background: open
                ? "rgba(240,169,59,0.08)"
                : "rgba(255,255,255,0.04)",
            }}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M2 2l9 9M11 2L2 11"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path
                  d="M1 1h12M1 5h12M1 9h12"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        className="overflow-hidden border-t transition-all duration-200 md:hidden"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "rgba(6,6,6,0.97)",
          maxHeight: open ? "260px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <nav className="mx-auto max-w-6xl space-y-0.5 px-6 py-3 sm:px-10">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wider transition ${
                  active ? "text-seal" : "text-ink-dim hover:text-ink"
                }`}
              >
                {active && (
                  <span className="size-1 rounded-full bg-seal" />
                )}
                {l.label}
              </Link>
            );
          })}
          <div
            className="my-2 h-px"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/10"
          >
            Open console →
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SealMark() {
  return (
    <div className="relative grid size-8 place-items-center rounded-md border border-seal/40 bg-seal/10">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"
          stroke="var(--seal)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 12l2.5 2.5 4.5-5"
          stroke="var(--seal)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
