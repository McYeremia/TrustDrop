import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      className="relative z-10 border-t"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="font-mono text-base font-bold text-white">TrustDrop</div>
            <p className="mt-1 max-w-sm text-sm leading-snug" style={{ color: "#666" }}>
              Verifiable, privacy-preserving social-aid disbursement on Terminal 3.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-wider" style={{ color: "#555" }}>
            <Link href="/how-it-works" className="transition hover:text-white">
              How it works
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              Live demo
            </Link>
            <Link href="/app" className="transition hover:text-seal">
              Console
            </Link>
          </nav>
        </div>
        <div
          className="mt-8 border-t pt-5 text-center font-mono text-[11px]"
          style={{ borderColor: "rgba(255,255,255,0.05)", color: "#333" }}
        >
          T3N testnet demo · inspired by a real problem in Indonesia where bansos
          doesn&rsquo;t always reach its recipients · synthetic data · not a
          government production system
        </div>
      </div>
    </footer>
  );
}
