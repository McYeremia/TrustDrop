import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display serif with editorial gravitas — "official document" weight.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

// Clean, slightly humanist grotesque for body/UI.
const hanken = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Technical mono for ledger data, DIDs, payloads.
const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrustDrop — Verified Social-Aid Disbursement",
  description:
    "An AI agent that verifies eligibility and disburses social aid on behalf of institutions — without ever holding citizens' PII — with an immutable audit trail. Inspired by a real-world problem in Indonesia, where social aid (bansos) doesn't always reach its intended recipients.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
