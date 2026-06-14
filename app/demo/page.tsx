"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/_ui/SiteNav";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { rupiah, shortDid, Field, Corner, Empty } from "@/app/_ui/primitives";

interface Disbursement {
  received_at: string;
  tx_id: string;
  recipient_did: string;
  recipient_name: string;
  amount: number;
  currency: string;
  period: string;
  run_id: string;
  extra: Record<string, unknown>;
}

export default function DemoPage() {
  const [rows, setRows] = useState<Disbursement[]>([]);
  const [live, setLive] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/mock-provider", { cache: "no-store" });
        const data = (await res.json()) as { disbursements: Disbursement[] };
        if (!active) return;
        setLive(true);
        const incoming = data.disbursements ?? [];
        const newIds = incoming
          .map((d) => d.tx_id)
          .filter((id) => !seen.current.has(id));
        if (newIds.length) {
          newIds.forEach((id) => seen.current.add(id));
          setFresh(new Set(newIds));
          setTimeout(() => active && setFresh(new Set()), 1500);
        }
        setRows(incoming);
      } catch {
        if (active) setLive(false);
      }
    }
    poll();
    const t = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const latest = rows[0];

  return (
    <div
      className="grain relative min-h-screen overflow-x-hidden"
      style={{ background: "#080808" }}
    >
      <SiteNav />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="guilloche pointer-events-none absolute inset-0 h-[320px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 rounded-full"
          style={{
            width: 400,
            height: 300,
            background: "radial-gradient(ellipse, rgba(240,169,59,0.08), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-20 sm:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-seal">
              Live demo
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <span
                className={`size-1.5 rounded-full ${
                  live ? "bg-seal seal-pulse" : ""
                }`}
                style={!live ? { background: "#444" } : undefined}
              />
              <span style={{ color: live ? "var(--seal)" : "#666" }}>
                {live ? "testnet · live" : "connecting"}
              </span>
            </span>
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tighter text-white sm:text-6xl">
            One transaction,{" "}
            <span className="gold-shine gold-glow">two levels</span> of visibility.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: "#8a8a8a" }}>
            The same disbursement, seen from both sides of the PII boundary. The
            provider receives the citizen&rsquo;s real name; the agent receives
            only a transaction id. Run a disbursement from the{" "}
            <Link href="/app" className="text-seal underline-offset-4 hover:underline">
              operator console
            </Link>{" "}
            and watch a new row appear below.
          </p>
        </div>
      </section>

      {/* ── Money shot ───────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 sm:px-10">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <ProviderView d={latest} />
          <Divider />
          <AgentView d={latest} />
        </div>
      </section>

      {/* ── Ledger ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div
          className="mb-6 flex items-end justify-between gap-4 border-b pb-3"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-2xl font-black tracking-tighter text-white">
            Provider-side ledger
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "#444" }}>
            {rows.length} transactions · every 2.5s
          </span>
        </div>
        <Ledger rows={rows} fresh={fresh} />
      </section>

      <SiteFooter />
    </div>
  );
}

function ProviderView({ d }: { d?: Disbursement }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: "linear-gradient(to bottom, rgba(240,169,59,0.07), transparent)",
        border: "1px solid rgba(240,169,59,0.3)",
      }}
    >
      <Corner color="var(--pii)" />
      <span
        className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{
          borderColor: "rgba(240,169,59,0.35)",
          background: "rgba(240,169,59,0.1)",
          color: "var(--pii)",
        }}
      >
        Inside enclave → provider
      </span>
      <h3 className="mt-3 text-xl font-bold text-white">What the provider receives</h3>
      <p className="mb-5 text-sm" style={{ color: "#7a7a7a" }}>
        Citizen PII, resolved by the host inside the TEE.
      </p>
      {d ? (
        <dl className="space-y-3 font-mono text-sm">
          <Field label="recipient_name" value={d.recipient_name} pii />
          <Field label="amount" value={rupiah(d.amount)} />
          <Field label="recipient_did" value={shortDid(d.recipient_did)} dim />
          <Field label="period" value={d.period} dim />
        </dl>
      ) : (
        <Empty tone="pii" />
      )}
    </div>
  );
}

function AgentView({ d }: { d?: Disbursement }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: "linear-gradient(to bottom, rgba(240,169,59,0.05), transparent)",
        border: "1px solid rgba(240,169,59,0.2)",
      }}
    >
      <Corner color="var(--seal)" />
      <span
        className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-seal"
        style={{
          borderColor: "rgba(240,169,59,0.3)",
          background: "rgba(240,169,59,0.08)",
        }}
      >
        Response to agent · sanitised
      </span>
      <h3 className="mt-3 text-xl font-bold text-white">What the agent sees</h3>
      <p className="mb-5 text-sm" style={{ color: "#7a7a7a" }}>
        Only status &amp; tx_id. Zero PII.
      </p>
      {d ? (
        <dl className="space-y-3 font-mono text-sm">
          <Field label="status" value="SUCCESS" seal />
          <Field label="tx_id" value={d.tx_id} />
          <Field label="recipient_did" value={shortDid(d.recipient_did)} dim />
          <div
            className="flex items-center justify-between border-t pt-3"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <span style={{ color: "#555" }}>recipient_name</span>
            <span
              className="rounded px-2 py-0.5 line-through decoration-alert/70"
              style={{ background: "rgba(255,255,255,0.05)", color: "#555" }}
            >
              never seen
            </span>
          </div>
        </dl>
      ) : (
        <Empty tone="seal" />
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="relative flex items-center justify-center lg:flex-col">
      <div
        className="hidden h-full w-px lg:block"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(240,169,59,0.2), transparent)",
        }}
      />
      <div
        className="grid size-10 place-items-center rounded-full lg:absolute"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#111",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="var(--seal)" strokeWidth="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--seal)" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

function Ledger({ rows, fresh }: { rows: Disbursement[]; fresh: Set<string> }) {
  if (!rows.length) {
    return (
      <div
        className="rounded-2xl border border-dashed py-16 text-center"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <p className="font-mono text-sm" style={{ color: "#444" }}>
          No disbursements recorded yet — run one from the console.
        </p>
      </div>
    );
  }
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div
        className="grid grid-cols-[1.4fr_1fr_0.8fr_1.2fr] gap-4 border-b px-5 py-3 font-mono text-[10px] uppercase tracking-wider"
        style={{
          borderColor: "rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.03)",
          color: "#444",
        }}
      >
        <span>recipient_name (PII)</span>
        <span>tx_id</span>
        <span>amount</span>
        <span className="text-right">received_at</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.tx_id}
          className={`grid grid-cols-[1.4fr_1fr_0.8fr_1.2fr] items-center gap-4 border-b px-5 py-3.5 font-mono text-sm last:border-0 ${
            fresh.has(r.tx_id) ? "ledger-in" : ""
          }`}
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="size-1.5 shrink-0 rounded-full bg-pii" />
            <span className="truncate text-pii">{r.recipient_name}</span>
          </span>
          <span className="truncate" style={{ color: "#666" }}>
            {r.tx_id}
          </span>
          <span className="text-white">{rupiah(r.amount)}</span>
          <span className="truncate text-right" style={{ color: "#444" }}>
            {new Date(r.received_at).toLocaleTimeString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}
