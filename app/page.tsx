import Link from "next/link";
import { SiteNav } from "@/app/_ui/SiteNav";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { LiveStats } from "@/app/_ui/LiveStats";
import { LiveStatCards } from "@/app/_ui/LiveStatCards";
import { InteractiveBackground } from "@/app/_ui/InteractiveBackground";

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#080808" }}
    >
      <div className="grain" aria-hidden />

      {/* Ambient glows — all gold */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="blob drift"
          style={{
            position: "absolute",
            top: "-120px",
            left: "-100px",
            width: "700px",
            height: "700px",
            background: "radial-gradient(circle, rgba(240,169,59,0.14), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(90px)",
          }}
        />
        <div
          className="blob drift-slow"
          style={{
            position: "absolute",
            top: "5%",
            right: "-250px",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(240,169,59,0.07), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(90px)",
          }}
        />
        <div
          className="blob drift"
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "30%",
            width: "500px",
            height: "500px",
            background: "radial-gradient(circle, rgba(240,169,59,0.05), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(70px)",
          }}
        />
      </div>

      {/* Background watermark */}
      <div aria-hidden className="watermark-bg pointer-events-none select-none">
        TRUSTDROP
      </div>

      <InteractiveBackground />
      <SiteNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-20 sm:px-10 sm:pt-28">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
          {/* Left — headline */}
          <div>
            <div
              className="reveal mb-8 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 glass font-mono text-[11px] uppercase tracking-wider text-seal"
            >
              <span className="size-1.5 rounded-full bg-seal seal-pulse" />
              Terminal 3 · Agent Auth SDK
            </div>

            <h1
              className="reveal text-[clamp(52px,7vw,72px)] font-black leading-[0.96] tracking-tighter text-white"
              style={{ animationDelay: "60ms" }}
            >
              Aid that
              <br />
              can&rsquo;t be{" "}
              <span className="gold-shine gold-glow">skimmed</span>,
              <br />
              <span style={{ color: "#999999" }}>faked, or leaked.</span>
            </h1>

            <p
              className="reveal mt-8 max-w-lg text-base leading-relaxed sm:text-lg"
              style={{ color: "#a0a0a0", animationDelay: "150ms" }}
            >
              AI verifies eligibility. Identity stays sealed in the enclave.
              Every disbursement is permanently audited.
            </p>

            <div
              className="reveal mt-10 flex flex-wrap gap-3"
              style={{ animationDelay: "230ms" }}
            >
              <Link
                href="/app"
                className="gold-btn rounded-full px-7 py-3.5 text-sm font-bold tracking-wide"
              >
                Open the console
              </Link>
              <Link
                href="/demo"
                className="glass rounded-full px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-white/10"
              >
                Watch live demo
              </Link>
            </div>

            <p
              className="reveal mt-8 text-sm italic"
              style={{ color: "#707070", animationDelay: "310ms" }}
            >
              Inspired by Indonesia&rsquo;s bansos leakage problem.
            </p>
          </div>

          {/* Right — crystal cluster with labelled icons */}
          <div
            className="reveal hidden lg:flex items-center justify-center"
            style={{ animationDelay: "80ms" }}
          >
            <CrystalCluster />
          </div>
        </div>
      </section>

      {/* ── Gold divider ─────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="relative z-10 mx-auto max-w-7xl px-6 sm:px-10"
      >
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(240,169,59,0.18) 30%, rgba(240,169,59,0.18) 70%, transparent)",
          }}
        />
      </div>

      {/* ── Issuer strip ────────────────────────────────────────────────── */}
      <section className="relative z-10 py-10">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <p
            className="mb-7 text-center font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: "#555" }}
          >
            Our Issuers
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-14"
            style={{ opacity: 0.5 }}
          >
            {[
              "Tax Office (DJP)",
              "BPS Statistics",
              "Dukcapil",
              "BPJS Health",
              "Bank Indonesia",
            ].map((name) => (
              <span
                key={name}
                className="font-mono text-sm font-medium tracking-wide"
                style={{ color: "#aaa" }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Proven Architecture ──────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
        {/* Subtle gold spot behind this section */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 500,
            height: 300,
            background:
              "radial-gradient(ellipse, rgba(240,169,59,0.06), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="relative lg:grid lg:grid-cols-2 lg:items-start lg:gap-24">
          <div>
            <h2 className="text-4xl font-black leading-[1.0] tracking-tighter text-white sm:text-[3.5rem]">
              Our Proven
              <br />
              <span className="gold-shine gold-glow">Architecture</span>
            </h2>
          </div>
          <div className="mt-8 lg:mt-2">
            <p
              className="text-base leading-relaxed sm:text-lg"
              style={{ color: "#8a8a8a" }}
            >
              Within milliseconds, our TEE contract verifies eligibility,
              resolves PII inside the enclave, and disburses aid — with zero
              data exposure at any point. The immutable audit trail proves every
              disbursement was policy-compliant.
            </p>
            <div
              className="mt-8 h-px"
              style={{
                background:
                  "linear-gradient(90deg, rgba(240,169,59,0.5), transparent)",
              }}
            />
            <p
              className="mt-5 text-sm leading-relaxed"
              style={{ color: "#666" }}
            >
              Built on the Terminal 3 Agent Auth SDK. The AI agent orchestrates
              the run — the TEE contract executes the truth.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats grid + CTA card ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 sm:px-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left 2 cols — live stats */}
          <LiveStatCards />

          {/* Right col — CTA */}
          <div
            className="reveal cta-dark-card flex flex-col rounded-2xl p-8"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex-1">
              <h3 className="text-2xl font-black leading-tight text-white">
                Interested in
                <br />
                TrustDrop?
              </h3>
              <p
                className="mt-4 text-sm leading-relaxed"
                style={{ color: "#7a7a7a" }}
              >
                Our team proved the TEE can run a full aid disbursement cycle
                without a single PII leak to any agent or operator.
              </p>
              <div className="mt-6">
                <Link
                  href="/app"
                  className="gold-btn rounded-full px-6 py-3 text-sm font-bold tracking-wide"
                >
                  Get Started
                </Link>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <MiniCrystal />
            </div>
          </div>
        </div>
      </section>

      {/* ── Three frauds ─────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 sm:px-10">
        <div className="mb-12">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-seal"
          >
            What it stops
          </span>
          <h2 className="mt-3 text-4xl font-black tracking-tighter text-white sm:text-5xl">
            Three frauds,{" "}
            <span className="gold-shine gold-glow">struck out</span>.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Fake poverty letters",
              d: "A wealthy applicant can't make the tax office sign 'low income'. Signatures can't be forged the way paper SKTM can.",
            },
            {
              n: "02",
              t: "Ghost & duplicate claims",
              d: "One identity, one claim per period. The contract's dedup ledger rejects repeats outright.",
            },
            {
              n: "03",
              t: "Skimming the amount",
              d: "Officials never type a number. The contract assigns the tier amount, so there's nothing to mark up.",
            },
          ].map((f, i) => (
            <div
              key={f.n}
              className="dark-stat-card reveal rounded-2xl p-7"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mb-5 flex items-center justify-between">
                <span
                  className="text-3xl font-black"
                  style={{ color: "#444444" }}
                >
                  {f.n}
                </span>
                <span
                  className="rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                  style={{
                    borderColor: "rgba(232,101,79,0.3)",
                    background: "rgba(232,101,79,0.07)",
                    color: "#e8654f",
                  }}
                >
                  blocked
                </span>
              </div>
              <h3 className="text-base font-bold text-white sm:text-lg">{f.t}</h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "#999" }}
              >
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live stats ───────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 sm:px-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="size-2 rounded-full bg-seal seal-pulse" />
          <span
            className="font-mono text-xs uppercase tracking-wider"
            style={{ color: "#555" }}
          >
            Live from the testnet ledger
          </span>
        </div>
        <LiveStats />
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-28 sm:px-10">
        <div
          className="cta-dark-card relative overflow-hidden rounded-[2rem] p-10 text-center sm:p-16"
          style={{ borderColor: "rgba(240,169,59,0.18)" }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-48"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(240,169,59,0.7), transparent)",
            }}
          />
          {/* Subtle radial gold glow center */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 400,
              height: 200,
              background:
                "radial-gradient(ellipse, rgba(240,169,59,0.07), transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <span
            className="relative mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-seal"
          >
            <span
              className="h-px w-6"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--seal))",
              }}
            />
            The money shot
          </span>
          <h2 className="relative mt-2 text-4xl font-black leading-tight tracking-tighter text-white sm:text-5xl">
            See it disburse{" "}
            <span className="gold-shine gold-glow">
              without seeing a soul
            </span>
            .
          </h2>
          <p
            className="relative mx-auto mt-4 max-w-lg text-base"
            style={{ color: "#7a7a7a" }}
          >
            Step through the console as a recipient, an operator, and an
            auditor — and watch the citizen&rsquo;s identity stay sealed the
            whole way.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="gold-btn rounded-full px-7 py-3.5 text-sm font-bold tracking-wide"
            >
              Open the console
            </Link>
            <Link
              href="/how-it-works"
              className="glass rounded-full px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-white/10"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Crystal cluster — hero right side ───────────────────────────────────── */

function CrystalCluster() {
  return (
    <div
      className="relative"
      style={{ width: 400, height: 460 }}
      aria-label="Three TrustDrop pillars: Verify, Seal, Audit"
    >
      {/* Ambient gold glow */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          top: "40%",
          left: "48%",
          transform: "translate(-50%, -50%)",
          width: 250,
          height: 250,
          background:
            "radial-gradient(circle, rgba(240,169,59,0.3), transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* ① Center — large gold diamond · VERIFY */}
      <div
        className="float-slow absolute"
        style={{ top: "44%", left: "46%", transform: "translate(-50%, -60%)" }}
      >
        <svg width="175" height="175" viewBox="0 0 100 120">
          <defs>
            <linearGradient id="cg-verify" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,208,80,0.48)" />
              <stop offset="50%" stopColor="rgba(240,169,59,0.14)" />
              <stop offset="100%" stopColor="rgba(240,169,59,0.44)" />
            </linearGradient>
          </defs>
          <polygon
            points="50,4 96,37 96,83 50,116 4,83 4,37"
            fill="url(#cg-verify)"
            stroke="rgba(255,200,60,0.75)"
            strokeWidth="1.2"
          />
          <polygon
            points="50,18 83,42 83,78 50,102 17,78 17,42"
            fill="rgba(255,190,40,0.06)"
            stroke="rgba(255,190,40,0.2)"
            strokeWidth="0.6"
          />
          {/* Shield shape */}
          <path
            d="M50,36 L66,44 L66,60 Q66,72 50,80 Q34,72 34,60 L34,44 Z"
            fill="rgba(240,169,59,0.15)"
            stroke="rgba(240,169,59,0.75)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {/* Checkmark */}
          <path
            d="M42,58 L47.5,63.5 L59,51"
            stroke="rgba(255,210,60,0.95)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div
          className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(240,169,59,0.7)" }}
        >
          Verify
        </div>
      </div>

      {/* ② Top-right — medium outline diamond · SEAL */}
      <div
        className="float-med absolute"
        style={{ top: "3%", right: "4%", animationDelay: "1.4s" }}
      >
        <svg width="110" height="110" viewBox="0 0 100 120">
          <polygon
            points="50,4 96,37 96,83 50,116 4,83 4,37"
            fill="rgba(240,169,59,0.05)"
            stroke="rgba(240,169,59,0.45)"
            strokeWidth="1.8"
          />
          <polygon
            points="50,20 80,40 80,80 50,100 20,80 20,40"
            fill="transparent"
            stroke="rgba(240,169,59,0.13)"
            strokeWidth="0.7"
          />
          {/* Lock — body */}
          <rect
            x="38" y="54" width="24" height="18" rx="3"
            fill="rgba(240,169,59,0.12)"
            stroke="rgba(240,169,59,0.6)"
            strokeWidth="1.4"
          />
          {/* Lock — shackle */}
          <path
            d="M43,54 L43,46 Q43,38 50,38 Q57,38 57,46 L57,54"
            fill="none"
            stroke="rgba(240,169,59,0.6)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Keyhole */}
          <circle cx="50" cy="62" r="2.5" fill="rgba(240,169,59,0.55)" />
          <rect x="49" y="63" width="2" height="4" rx="1" fill="rgba(240,169,59,0.55)" />
        </svg>
        <div
          className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(240,169,59,0.6)" }}
        >
          Seal
        </div>
      </div>

      {/* ③ Bottom-right — dark diamond · AUDIT */}
      <div
        className="float-slow absolute"
        style={{ bottom: "3%", right: "0%", animationDelay: "2.8s" }}
      >
        <svg width="132" height="132" viewBox="0 0 100 120">
          <defs>
            <linearGradient id="cg-audit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(24,24,24,0.97)" />
              <stop offset="100%" stopColor="rgba(10,10,10,0.98)" />
            </linearGradient>
          </defs>
          <polygon
            points="50,4 96,37 96,83 50,116 4,83 4,37"
            fill="url(#cg-audit)"
            stroke="rgba(240,169,59,0.22)"
            strokeWidth="1.2"
          />
          {/* Document / ledger */}
          <rect
            x="36" y="38" width="28" height="34" rx="3"
            fill="rgba(240,169,59,0.07)"
            stroke="rgba(240,169,59,0.45)"
            strokeWidth="1.2"
          />
          {/* Lines inside document */}
          <line x1="41" y1="48" x2="59" y2="48" stroke="rgba(240,169,59,0.5)" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="41" y1="54" x2="59" y2="54" stroke="rgba(240,169,59,0.5)" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="41" y1="60" x2="52" y2="60" stroke="rgba(240,169,59,0.5)" strokeWidth="1.2" strokeLinecap="round" />
          {/* Checkmark on last line */}
          <path
            d="M54,58 L57,61 L62,55"
            stroke="rgba(240,169,59,0.85)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div
          className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(240,169,59,0.6)" }}
        >
          Audit
        </div>
      </div>

      {/* ④ Top-left — tiny decorative accent */}
      <div
        className="float-med absolute"
        style={{ top: "24%", left: "0%", animationDelay: "0.7s" }}
      >
        <svg width="58" height="58" viewBox="0 0 100 120">
          <polygon
            points="50,4 96,37 96,83 50,116 4,83 4,37"
            fill="rgba(240,169,59,0.03)"
            stroke="rgba(240,169,59,0.18)"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}

function MiniCrystal() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 100 120"
      className="float-slow"
      aria-hidden
      style={{ animationDelay: "0.4s" }}
    >
      <defs>
        <linearGradient id="mg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,210,80,0.4)" />
          <stop offset="100%" stopColor="rgba(240,169,59,0.08)" />
        </linearGradient>
      </defs>
      <polygon
        points="50,4 96,37 96,83 50,116 4,83 4,37"
        fill="url(#mg1)"
        stroke="rgba(240,169,59,0.5)"
        strokeWidth="1.8"
      />
      {/* Shield + check */}
      <path
        d="M50,34 L62,40 L62,54 Q62,64 50,70 Q38,64 38,54 L38,40 Z"
        fill="rgba(240,169,59,0.12)"
        stroke="rgba(240,169,59,0.6)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M44,52 L48.5,56.5 L57,48"
        stroke="rgba(255,210,60,0.9)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
