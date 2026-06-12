//! check_eligibility: verify a single recipient against policy rules.
//!
//! Reads the recipient profile from KV `recipients` and the policy from
//! KV `policy`. Checks region and income bracket. Returns a boolean
//! verdict and reason code — NO PII crosses the WIT boundary.

#[derive(serde::Deserialize)]
pub struct CheckEligibilityReq {
    pub recipient_did: String,
}

#[derive(serde::Serialize)]
pub struct CheckEligibilityResp {
    pub eligible: bool,
    pub reason_code: String,
    pub recipient_did: String,
}

/// Recipient profile stored in KV (PII — never returned to agent).
#[derive(serde::Deserialize)]
struct RecipientProfile {
    #[allow(dead_code)]
    pub recipient_did: String,
    #[allow(dead_code)]
    pub legal_name: String,
    #[allow(dead_code)]
    pub nik: String,
    #[allow(dead_code)]
    pub bank_account: String,
    pub region_code: String,
    pub income_bracket: String,
    #[allow(dead_code)]
    pub household_status: String,
}

/// Policy stored in KV.
#[derive(serde::Deserialize)]
struct Policy {
    pub eligible_regions: alloc::vec::Vec<alloc::string::String>,
    pub eligible_income_bracket: String,
    #[allow(dead_code)]
    pub amount_per_recipient: f64,
    #[allow(dead_code)]
    pub total_budget: f64,
    #[allow(dead_code)]
    pub period: String,
    #[allow(dead_code)]
    pub dedup: bool,
}

pub fn check_eligibility(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: CheckEligibilityReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("check-eligibility: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let resp = check_eligibility_wasm(req)?;
        serde_json::to_vec(&resp).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = req;
        Err("check_eligibility is only implemented on the wasm32 target".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{kv_store, logging},
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
fn check_eligibility_wasm(req: CheckEligibilityReq) -> Result<CheckEligibilityResp, String> {
    let tid = tenant_context::tenant_did();
    let recipients_map = crate::map_name(&tid, "recipients");
    let policy_map = crate::map_name(&tid, "policy");

    let _ = logging::info(&alloc::format!(
        "check-eligibility: checking recipient {}",
        req.recipient_did
    ));

    // Read recipient profile from KV
    let profile_bytes = kv_store::get(&recipients_map, req.recipient_did.as_bytes())
        .map_err(|e| alloc::format!("kv read recipients: {e}"))?
        .ok_or_else(|| alloc::format!(
            "recipient {} not found in {}",
            req.recipient_did, recipients_map
        ))?;

    let profile: RecipientProfile = serde_json::from_slice(&profile_bytes)
        .map_err(|e| alloc::format!("bad recipient profile: {e}"))?;

    // Read policy from KV
    let policy_bytes = kv_store::get(&policy_map, b"current")
        .map_err(|e| alloc::format!("kv read policy: {e}"))?
        .ok_or("policy 'current' not found — seed it via provision.ts")?;

    let policy: Policy = serde_json::from_slice(&policy_bytes)
        .map_err(|e| alloc::format!("bad policy: {e}"))?;

    // Check region
    if !policy.eligible_regions.contains(&profile.region_code) {
        let _ = logging::info(&alloc::format!(
            "check-eligibility: {} INELIGIBLE — region {} not in {:?}",
            req.recipient_did, profile.region_code, policy.eligible_regions
        ));
        return Ok(CheckEligibilityResp {
            eligible: false,
            reason_code: "REGION_MISMATCH".to_string(),
            recipient_did: req.recipient_did,
        });
    }

    // Check income bracket
    if profile.income_bracket != policy.eligible_income_bracket {
        let _ = logging::info(&alloc::format!(
            "check-eligibility: {} INELIGIBLE — income bracket {} != {}",
            req.recipient_did, profile.income_bracket, policy.eligible_income_bracket
        ));
        return Ok(CheckEligibilityResp {
            eligible: false,
            reason_code: "INCOME_MISMATCH".to_string(),
            recipient_did: req.recipient_did,
        });
    }

    let _ = logging::info(&alloc::format!(
        "check-eligibility: {} ELIGIBLE",
        req.recipient_did
    ));

    Ok(CheckEligibilityResp {
        eligible: true,
        reason_code: "ELIGIBLE".to_string(),
        recipient_did: req.recipient_did,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_eligibility_non_wasm_returns_err() {
        let input = serde_json::to_vec(&serde_json::json!({
            "recipient_did": "did:t3n:abc123"
        }))
        .unwrap();
        let result = check_eligibility(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("only implemented on the wasm32 target"));
    }

    #[test]
    fn check_eligibility_bad_input_returns_err() {
        let result = check_eligibility(b"not json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("bad input"));
    }
}
