//! prepare_batch: build a disbursement batch within budget & dedup constraints.
//!
//! Scans the PII-free `eligibility` KV map, runs eligibility checks inline,
//! verifies against the dedup ledger (`disbursed-<period>`), and returns a list
//! of approved `(recipient_did, amount)` pairs within the total budget.
//! NO PII crosses the WIT boundary — the map holds only region/income, never
//! bank account or name.

#[derive(serde::Deserialize)]
pub struct PrepareBatchReq {
    pub period: String,
    pub policy: BatchPolicy,
}

#[derive(serde::Deserialize)]
pub struct BatchPolicy {
    pub eligible_regions: alloc::vec::Vec<alloc::string::String>,
    pub eligible_income_bracket: String,
    pub amount_per_recipient: f64,
    pub total_budget: f64,
}

#[derive(serde::Serialize)]
pub struct PrepareBatchResp {
    pub approved: alloc::vec::Vec<ApprovedRecipient>,
    pub total_amount: f64,
    pub count: u32,
}

#[derive(serde::Serialize)]
pub struct ApprovedRecipient {
    pub recipient_did: String,
    pub amount: f64,
}

/// Minimal PII-free eligibility record needed for batch eligibility.
#[derive(serde::Deserialize)]
struct EligibilityRecord {
    pub recipient_did: String,
    pub region_code: String,
    pub income_bracket: String,
}

pub fn prepare_batch(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: PrepareBatchReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("prepare-batch: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let resp = prepare_batch_wasm(req)?;
        serde_json::to_vec(&resp).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = req;
        Err("prepare_batch is only implemented on the wasm32 target".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{kv_store, logging},
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
fn prepare_batch_wasm(req: PrepareBatchReq) -> Result<PrepareBatchResp, String> {
    let tid = tenant_context::tenant_did();
    let eligibility_map = crate::map_name(&tid, "eligibility");
    let dedup_map = crate::map_name(&tid, &alloc::format!("disbursed-{}", req.period));

    let _ = logging::info(&alloc::format!(
        "prepare-batch: scanning recipients for period {}, budget {}, amount/recipient {}",
        req.period, req.policy.total_budget, req.policy.amount_per_recipient
    ));

    // Read the recipient index (list of all recipient DIDs)
    let index_bytes = kv_store::get(&eligibility_map, b"_index")
        .map_err(|e| alloc::format!("kv read eligibility index: {e}"))?
        .ok_or("eligibility _index not found — seed eligibility via provision.ts")?;

    let recipient_dids: alloc::vec::Vec<alloc::string::String> =
        serde_json::from_slice(&index_bytes)
            .map_err(|e| alloc::format!("bad recipients index: {e}"))?;

    let mut approved = alloc::vec::Vec::new();
    let mut total_amount = 0.0_f64;

    for did in &recipient_dids {
        // Budget check
        if total_amount + req.policy.amount_per_recipient > req.policy.total_budget {
            let _ = logging::info(&alloc::format!(
                "prepare-batch: budget exhausted at {} of {}",
                total_amount, req.policy.total_budget
            ));
            break;
        }

        // Dedup check — skip if already disbursed this period
        let already_disbursed = kv_store::get(&dedup_map, did.as_bytes())
            .map_err(|e| alloc::format!("kv read dedup: {e}"))?;
        if already_disbursed.is_some() {
            let _ = logging::info(&alloc::format!(
                "prepare-batch: {} already disbursed in period {}",
                did, req.period
            ));
            continue;
        }

        // Read recipient's PII-free eligibility record
        let record_bytes = match kv_store::get(&eligibility_map, did.as_bytes())
            .map_err(|e| alloc::format!("kv read eligibility: {e}"))? {
            Some(bytes) => bytes,
            None => {
                let _ = logging::error(&alloc::format!(
                    "prepare-batch: recipient {} in index but not in map",
                    did
                ));
                continue;
            }
        };

        let profile: EligibilityRecord = match serde_json::from_slice(&record_bytes) {
            Ok(p) => p,
            Err(e) => {
                let _ = logging::error(&alloc::format!(
                    "prepare-batch: bad eligibility record for {}: {e}",
                    did
                ));
                continue;
            }
        };

        // Region check
        if !req.policy.eligible_regions.contains(&profile.region_code) {
            continue;
        }

        // Income bracket check
        if profile.income_bracket != req.policy.eligible_income_bracket {
            continue;
        }

        approved.push(ApprovedRecipient {
            recipient_did: profile.recipient_did,
            amount: req.policy.amount_per_recipient,
        });
        total_amount += req.policy.amount_per_recipient;
    }

    let count = approved.len() as u32;

    let _ = logging::info(&alloc::format!(
        "prepare-batch: approved {} recipients, total amount {}",
        count, total_amount
    ));

    Ok(PrepareBatchResp {
        approved,
        total_amount,
        count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepare_batch_non_wasm_returns_err() {
        let input = serde_json::to_vec(&serde_json::json!({
            "period": "2026-06",
            "policy": {
                "eligible_regions": ["JKT"],
                "eligible_income_bracket": "low",
                "amount_per_recipient": 500000.0,
                "total_budget": 5000000.0
            }
        }))
        .unwrap();
        let result = prepare_batch(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("only implemented on the wasm32 target"));
    }

    #[test]
    fn prepare_batch_bad_input_returns_err() {
        let result = prepare_batch(b"not json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("bad input"));
    }
}
