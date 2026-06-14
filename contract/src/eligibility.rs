//! check_eligibility: verify a single recipient against policy rules.
//!
//! Reads the recipient's eligibility record from KV `eligibility` (PII-FREE:
//! only recipient_did, region_code, income_bracket) and the policy from KV
//! `policy`. Checks region and income bracket. Returns a boolean verdict and
//! reason code. PII (bank account, name, NIK) NEVER enters this contract —
//! it lives in each recipient's own T3N profile and is only resolved via
//! `{{profile.*}}` placeholders inside the enclave at disbursement time.

#[derive(serde::Deserialize)]
pub struct CheckEligibilityReq {
    pub recipient_did: String,
}

#[derive(serde::Serialize)]
pub struct CheckEligibilityResp {
    pub eligible: bool,
    pub reason_code: String,
    pub recipient_did: String,
    pub tier: String,
    pub amount: f64,
}

/// Eligibility record stored in KV `eligibility` — PII-FREE by construction.
/// Only the attributes needed to evaluate policy. No bank account, name, or NIK.
#[derive(serde::Deserialize)]
struct EligibilityRecord {
    #[allow(dead_code)]
    pub recipient_did: String,
    pub region_code: String,
    pub income_bracket: String,
    #[serde(default)]
    pub household_status: String,
    #[serde(default)]
    pub attested: bool,
}

/// Policy stored in KV.
#[derive(serde::Deserialize)]
struct Policy {
    pub eligible_regions: alloc::vec::Vec<alloc::string::String>,
    #[serde(default)]
    pub eligible_income_brackets: alloc::vec::Vec<alloc::string::String>,
    #[allow(dead_code)]
    #[serde(default)]
    pub total_budget: f64,
    #[allow(dead_code)]
    #[serde(default)]
    pub period: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub dedup: bool,
}

/// Pure tier→amount rule. Returns (tier_code, amount) or None if ineligible by income.
/// Mirrors policy.tiers; kept as a pure fn so it is unit-testable on native target.
pub fn assign_tier(income_bracket: &str, household_status: &str) -> Option<(&'static str, f64)> {
    match income_bracket {
        "low" => match household_status {
            "elderly" | "disabled" | "single_parent" => Some(("G1", 700000.0)),
            _ => Some(("G2", 600000.0)),
        },
        "medium" => Some(("G3", 400000.0)),
        _ => None,
    }
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
    let eligibility_map = crate::map_name(&tid, "eligibility");
    let policy_map = crate::map_name(&tid, "policy");

    let _ = logging::info(&alloc::format!(
        "check-eligibility: checking recipient {}",
        req.recipient_did
    ));

    // Read recipient's PII-free eligibility record from KV
    let record_bytes = kv_store::get(&eligibility_map, req.recipient_did.as_bytes())
        .map_err(|e| alloc::format!("kv read eligibility: {e}"))?
        .ok_or_else(|| alloc::format!(
            "recipient {} not found in {}",
            req.recipient_did, eligibility_map
        ))?;

    let profile: EligibilityRecord = serde_json::from_slice(&record_bytes)
        .map_err(|e| alloc::format!("bad eligibility record: {e}"))?;

    // Read policy from KV
    let policy_bytes = kv_store::get(&policy_map, b"current")
        .map_err(|e| alloc::format!("kv read policy: {e}"))?
        .ok_or("policy 'current' not found — seed it via provision.ts")?;

    let policy: Policy = serde_json::from_slice(&policy_bytes)
        .map_err(|e| alloc::format!("bad policy: {e}"))?;

    // Must be attested by an issuer before any aid evaluation.
    if !profile.attested {
        let _ = logging::info(&alloc::format!(
            "check-eligibility: {} INELIGIBLE — not attested",
            req.recipient_did
        ));
        return Ok(CheckEligibilityResp {
            eligible: false,
            reason_code: "NOT_ATTESTED".to_string(),
            recipient_did: req.recipient_did,
            tier: "".to_string(),
            amount: 0.0,
        });
    }

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
            tier: "".to_string(),
            amount: 0.0,
        });
    }

    // Check income bracket against allowed set
    if !policy.eligible_income_brackets.contains(&profile.income_bracket) {
        let _ = logging::info(&alloc::format!(
            "check-eligibility: {} INELIGIBLE — income bracket {} not in {:?}",
            req.recipient_did, profile.income_bracket, policy.eligible_income_brackets
        ));
        return Ok(CheckEligibilityResp {
            eligible: false,
            reason_code: "INCOME_MISMATCH".to_string(),
            recipient_did: req.recipient_did,
            tier: "".to_string(),
            amount: 0.0,
        });
    }

    // Assign tier & amount from the rule (contract decides, not the operator).
    let (tier, amount) = match assign_tier(&profile.income_bracket, &profile.household_status) {
        Some(t) => t,
        None => {
            return Ok(CheckEligibilityResp {
                eligible: false,
                reason_code: "INCOME_MISMATCH".to_string(),
                recipient_did: req.recipient_did,
                tier: "".to_string(),
                amount: 0.0,
            });
        }
    };

    let _ = logging::info(&alloc::format!(
        "check-eligibility: {} ELIGIBLE tier={} amount={}",
        req.recipient_did, tier, amount
    ));

    Ok(CheckEligibilityResp {
        eligible: true,
        reason_code: "ELIGIBLE".to_string(),
        recipient_did: req.recipient_did,
        tier: tier.to_string(),
        amount,
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

    #[test]
    fn tier_g1_priority_for_low_vulnerable() {
        assert_eq!(assign_tier("low", "elderly"), Some(("G1", 700000.0)));
        assert_eq!(assign_tier("low", "disabled"), Some(("G1", 700000.0)));
        assert_eq!(assign_tier("low", "single_parent"), Some(("G1", 700000.0)));
    }

    #[test]
    fn tier_g2_regular_for_low_nonvulnerable() {
        assert_eq!(assign_tier("low", "head_of_family"), Some(("G2", 600000.0)));
        assert_eq!(assign_tier("low", "married"), Some(("G2", 600000.0)));
    }

    #[test]
    fn tier_g3_for_medium() {
        assert_eq!(assign_tier("medium", "married"), Some(("G3", 400000.0)));
        assert_eq!(assign_tier("medium", "elderly"), Some(("G3", 400000.0)));
    }

    #[test]
    fn tier_none_for_high_income() {
        assert_eq!(assign_tier("high", "elderly"), None);
    }
}
