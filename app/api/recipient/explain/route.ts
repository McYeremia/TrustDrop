import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const groq = new Groq({ apiKey });

    const resp = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Kamu asisten bansos yang menjelaskan hasil pencocokan program ke warga dengan Bahasa Indonesia yang hangat, ringkas, dan jelas (2-4 kalimat). Kamu TIDAK memutuskan kelayakan — itu sudah dihitung sistem; kamu hanya menjelaskan. Sebut program yang layak beserta jumlahnya, dan jelaskan singkat kenapa sebagian tidak cocok (wilayah/penghasilan/status). Jangan menyebut data pribadi. Nada menyemangati.",
        },
        {
          role: "user",
          content: `Hasil pencocokan program untuk pemohon ini (tanpa data pribadi):\n${JSON.stringify(matches, null, 2)}`,
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
