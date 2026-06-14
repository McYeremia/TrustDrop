/* Shared presentational primitives + formatters for the TrustDrop UI. */

export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function rupiahCompact(n: number) {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    const formatted = Number.isInteger(jt) ? String(jt) : jt.toFixed(1).replace(".", ",");
    return `Rp ${formatted}jt`;
  }
  if (n >= 1_000) {
    const rb = n / 1_000;
    const formatted = Number.isInteger(rb) ? String(rb) : rb.toFixed(1).replace(".", ",");
    return `Rp ${formatted}rb`;
  }
  return `Rp ${n}`;
}

export function shortDid(did: string) {
  if (!did?.startsWith("did:t3n:")) return did;
  const tail = did.slice("did:t3n:".length);
  return `did:t3n:${tail.slice(0, 6)}…${tail.slice(-4)}`;
}

export function SectionLabel({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-line/60 pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-seal">{n}</span>
        <h2 className="font-display text-2xl tracking-tight text-ink">{title}</h2>
      </div>
      <span className="hidden text-right font-mono text-[11px] uppercase tracking-wider text-ink-faint sm:block">
        {sub}
      </span>
    </div>
  );
}

export function Field({
  label,
  value,
  pii,
  seal,
  dim,
}: {
  label: string;
  value: string;
  pii?: boolean;
  seal?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-faint">{label}</span>
      <span
        className={`truncate text-right ${
          pii
            ? "rounded bg-pii/15 px-2 py-0.5 font-semibold text-pii"
            : seal
              ? "font-semibold text-seal"
              : dim
                ? "text-ink-dim"
                : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Corner({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none absolute -right-px -top-px size-16"
      style={{ background: `linear-gradient(225deg, ${color}22, transparent 60%)` }}
    />
  );
}

export function Empty({ tone, label }: { tone: "pii" | "seal"; label?: string }) {
  return (
    <div
      className={`rounded-lg border border-dashed py-10 text-center font-mono text-xs ${
        tone === "pii" ? "border-pii/25 text-pii/60" : "border-seal/25 text-seal/60"
      }`}
    >
      {label ?? "awaiting the first disbursement…"}
    </div>
  );
}
