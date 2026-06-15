/**
 * Tool layer for the TrustDrop AI agent.
 *
 * CRITICAL privacy invariant: every tool here returns ONLY PII-free data
 * (recipient_did + eligibility attributes). The LLM never receives a name, NIK,
 * or bank account — not even in a tool result. This is what makes "the agent
 * never sees PII" verifiable rather than merely asserted: inspect any tool
 * output below and you will find no PII field.
 */

export interface PlannedDisbursement {
  recipient_did: string;
  program_id: string;
  program_name: string;
  amount: number;
  tier: string;
}

export interface ToolContext {
  origin: string;
  /** When true, `disburse` only records intent (money requires human confirm). */
  dryRunDisburse: boolean;
  planned: PlannedDisbursement[];
}

export interface ToolStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

/** Groq/OpenAI-style tool schemas exposed to the model. */
export const toolDefs = [
  {
    type: "function" as const,
    function: {
      name: "list_pending_applications",
      description:
        "List aid applications awaiting an operator decision. Returns PII-free attested attributes only (region, income bracket, household status, computed tier & amount) plus a policy assessment: 'eligible' (boolean) and 'reason' when ineligible. Ineligible applicants must be rejected, not approved.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_all_applications",
      description:
        "List every application with its current status (pending/approved/rejected). PII-free.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "approve_application",
      description:
        "Approve an application for a specific program (recipient_did + program_id). Seeds the PII-free eligibility record into the TEE contract's KV map. Use only after confirming the attested attributes meet that program's policy.",
      parameters: {
        type: "object",
        properties: {
          recipient_did: { type: "string" },
          program_id: { type: "string" },
        },
        required: ["recipient_did", "program_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reject_application",
      description: "Reject an application for a specific program (recipient_did + program_id) with a short reason.",
      parameters: {
        type: "object",
        properties: {
          recipient_did: { type: "string" },
          program_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["recipient_did", "program_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_eligibility",
      description:
        "Run the TEE contract's check-eligibility for an approved application (recipient_did + program_id). Returns the contract's verdict { eligible, reason_code }. Use this as on-chain proof of eligibility after approving.",
      parameters: {
        type: "object",
        properties: {
          recipient_did: { type: "string" },
          program_id: { type: "string" },
        },
        required: ["recipient_did", "program_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "disburse",
      description:
        "Plan a disbursement for an approved application (recipient_did + program_id). You do NOT set the amount — it is fixed by the program's policy and looked up automatically. Disbursement is money-moving and always requires explicit human confirmation, so this records intent for the operator to approve.",
      parameters: {
        type: "object",
        properties: {
          recipient_did: { type: "string" },
          program_id: { type: "string" },
        },
        required: ["recipient_did", "program_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_audit_summary",
      description:
        "Get a PII-free summary of the public ledger: counts of decisions and disbursements and total aid delivered.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

interface AppRow {
  recipient_did: string;
  program_id: string;
  program_name: string;
  region_code: string;
  income_bracket: string;
  household_status: string;
  tier: string;
  amount: number;
  eligible: boolean;
  reason?: string;
  status: string;
}

/** Strip an application down to PII-free fields before it can reach the LLM. */
function piiFree(a: AppRow) {
  return {
    recipient_did: a.recipient_did,
    program_id: a.program_id,
    program_name: a.program_name,
    region_code: a.region_code,
    income_bracket: a.income_bracket,
    household_status: a.household_status,
    tier: a.tier,
    amount: a.amount,
    eligible: a.eligible,
    reason: a.reason,
    status: a.status,
  };
}

async function fetchApps(origin: string): Promise<AppRow[]> {
  const r = await fetch(`${origin}/api/operator/applications`, { cache: "no-store" });
  const j = await r.json();
  return (j.applications ?? []) as AppRow[];
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "list_pending_applications": {
      const apps = await fetchApps(ctx.origin);
      return apps.filter((a) => a.status === "pending").map(piiFree);
    }

    case "list_all_applications": {
      const apps = await fetchApps(ctx.origin);
      return apps.map(piiFree);
    }

    case "approve_application": {
      const r = await fetch(`${ctx.origin}/api/operator/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: args.recipient_did, program_id: args.program_id, decision: "approve" }),
      });
      const j = await r.json();
      if (!j.ok)
        return {
          error: `${j.reason ?? j.error ?? "approve failed"} — use exact recipient_did + program_id from list_pending_applications`,
        };
      return { ok: true, status: j.status };
    }

    case "reject_application": {
      const r = await fetch(`${ctx.origin}/api/operator/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: args.recipient_did, program_id: args.program_id, decision: "reject" }),
      });
      const j = await r.json();
      if (!j.ok)
        return {
          error: `${j.reason ?? j.error ?? "reject failed"} — use exact recipient_did + program_id from list_pending_applications`,
        };
      return { ok: true, status: j.status };
    }

    case "check_eligibility": {
      const r = await fetch(`${ctx.origin}/api/contract/check-eligibility`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: args.recipient_did, program_id: args.program_id }),
      });
      const j = await r.json();
      if (!j.ok) return { error: j.error };
      // Carry the source so the verdict isn't mistaken for a live TEE result
      // when it came from the deterministic fallback.
      return { ...j.result, source: j.source };
    }

    case "disburse": {
      const did = String(args.recipient_did);
      const pid = String(args.program_id);
      const apps = await fetchApps(ctx.origin);
      const app = apps.find((a) => a.recipient_did === did && a.program_id === pid);
      if (!app) return { error: "application not found for that recipient_did + program_id" };
      if (app.status !== "approved")
        return { error: "application is not approved yet — approve first" };

      // Money-moving: never execute inside the planning loop. Record intent.
      if (ctx.dryRunDisburse) {
        if (!ctx.planned.some((p) => p.recipient_did === did && p.program_id === pid)) {
          ctx.planned.push({
            recipient_did: did,
            program_id: pid,
            program_name: app.program_name,
            amount: app.amount,
            tier: app.tier,
          });
        }
        return {
          status: "PLANNED",
          recipient_did: did,
          program_id: pid,
          amount: app.amount,
          tier: app.tier,
          note: "Recorded for operator confirmation. Not yet executed.",
        };
      }

      const r = await fetch(`${ctx.origin}/api/contract/disburse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_did: did, program_id: pid, amount: app.amount, tier: app.tier }),
      });
      const j = await r.json();
      return { status: j.status, tx_id: j.tx_id };
    }

    case "get_audit_summary": {
      const r = await fetch(`${ctx.origin}/api/audit`, { cache: "no-store" });
      const j = await r.json();
      const disbursements = j.disbursements ?? [];
      const total = disbursements.reduce(
        (s: number, d: { amount: number }) => s + (d.amount || 0),
        0,
      );
      return {
        decisions: (j.decisions ?? []).length,
        disbursements: disbursements.length,
        total_aid: total,
      };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
