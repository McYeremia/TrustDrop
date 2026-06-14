"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/demo", label: "Live demo" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-50 backdrop-blur-xl" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(8,8,8,0.85)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <SealMark />
          <div className="leading-none">
            <div className="font-display text-base font-semibold tracking-tight text-ink">TrustDrop</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-engrave text-ink-faint">Verified Aid</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
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

        <Link
          href="/app"
          className="rounded-full border border-seal/40 bg-seal/10 px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-wider text-seal transition hover:bg-seal/20"
        >
          Console →
        </Link>
      </div>
    </header>
  );
}

function SealMark() {
  return (
    <div className="relative grid size-8 place-items-center rounded-md border border-seal/40 bg-seal/10">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" stroke="var(--seal)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 12l2.5 2.5 4.5-5" stroke="var(--seal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
