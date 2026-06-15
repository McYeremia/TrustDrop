import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint → cap per IP so it can't be used to drain the Groq quota.
const EXPLAIN_LIMIT = 15; // requests
const EXPLAIN_WINDOW = 60; // seconds

/**
 * Recipient-side AI: EXPLANATION ONLY. The LLM never decides eligibility — that
 * is the deterministic system's job. It only turns the already-computed matches
 * into a warm, plain-language summary for the citizen. No PII is sent.
 */
export async function POST(req: NextRequest) {
  try {
    const { matches } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GROQ_API_KEY missing" }, { status: 200 });
    }

    // Cap the user-controlled payload so it can't be used to smuggle a giant
    // prompt into the model.
    const matchesJson = JSON.stringify(matches ?? null);
    if (matchesJson.length > 4000) {
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 400 });
    }

    const rl = await rateLimit("explain", clientIp(req), EXPLAIN_LIMIT, EXPLAIN_WINDOW);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Too many requests — please wait ${rl.retryAfter}s.` },
        { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
      );
    }

    const groq = new Groq({ apiKey });

    const resp = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Kamu asisten bansos yang menjelaskan hasil pencocokan program ke warga dengan Bahasa Indonesia yang hangat, ringkas, dan jelas (2-4 kalimat). Kamu TIDAK memutuskan kelayakan — itu sudah dihitung sistem; kamu hanya menjelaskan. Sebut program yang layak beserta jumlahnya, dan jelaskan singkat kenapa sebagian tidak cocok (wilayah/penghasilan/status). Jangan menyebut data pribadi. Nada menyemangati.",
        },
        {
          role: "user",
          content: `Hasil pencocokan program untuk pemohon ini (tanpa data pribadi):\n${matchesJson}`,
        },
      ],
    });

    const text = resp.choices[0]?.message?.content ?? "";
    return NextResponse.json({ ok: true, explanation: text });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
