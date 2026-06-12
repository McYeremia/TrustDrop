import { NextRequest, NextResponse } from "next/server";

/**
 * Mock disbursement provider endpoint.
 *
 * This simulates a real payment provider (bank transfer API).
 * In the real flow, the TEE resolves PII (bank_account, recipient_name)
 * via http-with-placeholders BEFORE this endpoint receives the request.
 *
 * The "money shot" proof:
 *   - This endpoint receives the resolved PII (bank account, name).
 *   - The AI agent NEVER sees this data — it only sees the sanitised
 *     response (tx_id + status).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log the received data (this proves PII was resolved by TEE)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 MOCK PROVIDER: Disbursement request received");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Recipient DID  :", body.recipient_did);
    console.log("  Recipient Name :", body.recipient_name || "(placeholder not resolved)");
    console.log("  Bank Account   :", body.bank_account || "(placeholder not resolved)");
    console.log("  Amount         :", body.amount, body.currency || "IDR");
    console.log("  Period         :", body.period);
    console.log("  Run ID         :", body.run_id);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Generate a mock transaction ID
    const txId = `TX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Simulate processing delay (50-200ms)
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));

    // Return sanitised response (no PII in response)
    return NextResponse.json(
      {
        status: "success",
        tx_id: txId,
        recipient_did: body.recipient_did,
        amount: body.amount,
        currency: body.currency || "IDR",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("MOCK PROVIDER ERROR:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Mock provider internal error",
        tx_id: "",
      },
      { status: 500 }
    );
  }
}
