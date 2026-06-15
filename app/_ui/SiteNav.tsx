"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/demo", label: "Live demo" },
];

export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [ind, setInd] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const activeIndex = LINKS.findIndex((l) =>
    l.href === "/" ? path === "/" : path.startsWith(l.href),
  );

  // Slide a gold "seal" highlight to sit behind the active link.
  useEffect(() => {
    function measure() {
      const el = itemRefs.current[activeIndex];
      const nav = navRef.current;
      if (!el || !nav || activeIndex < 0) {
        setInd((i) => ({ ...i, ready: false }));
        return;
      }
      const er = el.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      setInd({ left: er.left - nr.left, width: er.width, ready: true });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, path]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <div
        className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:px-4"
        style={{
          background: "rgba(9,9,9,0.72)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          border: "1px solid rgba(240,169,59,0.14)",
          boxShadow:
            "0 14px 44px -24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          className="group relative flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <SealMark />
          <div className="leading-none">
            <div className="font-display text-base font-semibold tracking-tight text-ink">
              TrustDrop
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-seal seal-pulse" />
              <span className="font-mono text-[8.5px] uppercase tracking-engrave text-ink-faint">
                testnet · sealed
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop nav — ledger index with a sliding seal */}
        <nav ref={navRef} className="relative hidden items-center gap-2 md:flex">
          <span
            aria-hidden
            className="absolute inset-y-1 rounded-full transition-all duration-300 ease-out"
            style={{
              left: ind.left,
              width: ind.width,
              opacity: ind.ready ? 1 : 0,
              background: "rgba(240,169,59,0.12)",
              border: "1px solid rgba(240,169,59,0.32)",
              boxShadow: "0 0 18px -4px rgba(240,169,59,0.35)",
            }}
          />
          {LINKS.map((l, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={l.href}
                href={l.href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className={`relative z-10 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active ? "text-seal" : "text-ink-dim hover:text-ink"
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
            className="group relative hidden items-center gap-1.5 overflow-hidden rounded-full border border-seal/40 bg-seal/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-seal transition hover:bg-seal/20 sm:flex"
          >
            <span className="size-1 rounded-full bg-seal seal-pulse" />
            Console
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform group-hover:translate-x-0.5">
              <path d="M3 6h6M7 4l2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="flex size-9 items-center justify-center rounded-lg border transition md:hidden"
            style={{
              borderColor: open ? "rgba(240,169,59,0.3)" : "rgba(255,255,255,0.09)",
              background: open ? "rgba(240,169,59,0.08)" : "rgba(255,255,255,0.04)",
            }}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 2l9 9M11 2L2 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 1h12M1 5h12M1 9h12" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown — matching floating card */}
      <div
        className="mx-auto overflow-hidden rounded-2xl transition-all duration-200 md:hidden"
        style={{
          marginTop: open ? 8 : 0,
          maxHeight: open ? "300px" : "0px",
          opacity: open ? 1 : 0,
          border: open ? "1px solid rgba(240,169,59,0.14)" : "1px solid transparent",
          background: "rgba(6,6,6,0.95)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          maxWidth: "calc(72rem)",
        }}
      >
        <nav className="space-y-0.5 p-3">
          {LINKS.map((l, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wider transition ${
                  active ? "bg-seal/10 text-seal" : "text-ink-dim hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="my-2 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg bg-seal/10 px-3 py-2.5 font-mono text-sm uppercase tracking-wider text-seal transition hover:bg-seal/20"
          >
            <span className="size-1.5 rounded-full bg-seal seal-pulse" />
            Open console →
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SealMark() {
  return (
    <div className="relative grid size-9 place-items-center">
      {/* Rotating dashed seal ring */}
      <svg
        className="spin-slow absolute inset-0"
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden
      >
        <circle
          cx="18"
          cy="18"
          r="16"
          stroke="rgba(240,169,59,0.35)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      </svg>
      {/* Counter-rotating inner ring */}
      <svg
        className="spin-rev absolute inset-[3px]"
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        aria-hidden
      >
        <circle cx="15" cy="15" r="13" stroke="rgba(240,169,59,0.14)" strokeWidth="0.8" strokeDasharray="1 6" />
      </svg>
      {/* Shield + check core */}
      <div className="relative grid size-6 place-items-center rounded-md border border-seal/40 bg-seal/10">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
    </div>
  );
}
