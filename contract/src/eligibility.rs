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
    /// Which program's policy to evaluate against. Empty → legacy key "current".
    #[serde(default)]
    pub program_id: String,
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

/// Policy stored in KV, keyed by `program_id` (Fase 5: one map, many programs).
#[derive(serde::Deserialize)]
pub(crate) struct Policy {
    pub eligible_regions: alloc::vec::Vec<alloc::string::String>,
    #[serde(default)]
    pub eligible_income_brackets: alloc::vec::Vec<alloc::string::String>,
    /// Optional extra filter (e.g. elderly-only program). Empty = any household.
    #[serde(default)]
    pub eligible_household_statuses: alloc::vec::Vec<alloc::string::String>,
    /// Flat benefit; when > 0 it overrides the tier rule. 0 = use assign_tier.
    #[serde(default)]
    pub flat_amount: f64,
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

/// Household-status filter: empty allow-list means every household qualifies.
pub fn household_ok(allowed: &[alloc::string::String], household_status: &str) -> bool {
    allowed.is_empty() || allowed.iter().any(|h| h == household_status)
}

/// Benefit for a program: flat amount overrides the tier rule when set (> 0).
/// Returns (tier_code, amount), or None if income makes the person ineligible.
pub fn benefit_for(
    flat_amount: f64,
    income_bracket: &str,
    household_status: &str,
) -> Option<(alloc::string::String, f64)> {
    if flat_amount > 0.0 {
        return Some((alloc::string::String::from("FLAT"), flat_amount));
    }
    assign_tier(income_bracket, household_status)
        .map(|(t, a)| (alloc::string::String::from(t), a))
}

/// Policy KV key for a program id (legacy fallback to "current").
pub fn policy_key(program_id: &str) -> &str {
    if program_id.is_empty() { "current" } else { program_id }
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

    // Read this program's policy from KV (key = program_id, legacy "current").
    let key = policy_key(&req.program_id);
    let policy_bytes = kv_store::get(&policy_map, key.as_bytes())
        .map_err(|e| alloc::format!("kv read policy: {e}"))?
        .ok_or_else(|| alloc::format!("policy '{}' not found — seed it via provision.ts", key))?;

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

    // Optional household-status filter (e.g. elderly-only program).
    if !household_ok(&policy.eligible_household_statuses, &profile.household_status) {
        let _ = logging::info(&alloc::format!(
            "check-eligibility: {} INELIGIBLE — household {} not in {:?}",
            req.recipient_did, profile.household_status, policy.eligible_household_statuses
        ));
        return Ok(CheckEligibilityResp {
            eligible: false,
            reason_code: "HOUSEHOLD_MISMATCH".to_string(),
            recipient_did: req.recipient_did,
            tier: "".to_string(),
            amount: 0.0,
        });
    }

    // Benefit from the program policy (flat overrides tiers). Contract decides.
    let (tier, amount) = match benefit_for(policy.flat_amount, &profile.income_bracket, &profile.household_status) {
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

    #[test]
    fn household_ok_empty_allows_all() {
        assert!(household_ok(&[], "married"));
        assert!(household_ok(&[], "elderly"));
    }

    #[test]
    fn household_ok_filters_when_set() {
        let allowed = alloc::vec![alloc::string::String::from("elderly")];
        assert!(household_ok(&allowed, "elderly"));
        assert!(!household_ok(&allowed, "married"));
    }

    #[test]
    fn benefit_flat_overrides_tier() {
        assert_eq!(
            benefit_for(300000.0, "low", "married"),
            Some((alloc::string::String::from("FLAT"), 300000.0))
        );
    }

    #[test]
    fn benefit_falls_back_to_tier_when_no_flat() {
        assert_eq!(
            benefit_for(0.0, "low", "elderly"),
            Some((alloc::string::String::from("G1"), 700000.0))
        );
        assert_eq!(benefit_for(0.0, "high", "elderly"), None);
    }

    #[test]
    fn policy_key_uses_program_id_or_current() {
        assert_eq!(policy_key("jkt-cash-2026"), "jkt-cash-2026");
        assert_eq!(policy_key(""), "current");
    }
}
