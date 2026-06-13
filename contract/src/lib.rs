//! TrustDrop — verifiable social-aid disbursement TEE contract v0.1.0.
//!
//! Three exported functions:
//!   - `check-eligibility`:    verify recipient against policy (no PII out).
//!   - `prepare-batch`:        build disbursement batch within budget (no PII out).
//!   - `execute-disbursement`: call payment provider via `http-with-placeholders`
//!                             so bank account / name are resolved inside the enclave.
//!
//! # Architecture
//!
//! The AI agent (outside TEE) sends *instructions* (no PII). This contract
//! executes inside the TEE, resolves PII from the sealed KV store, calls the
//! payment provider, and returns sanitised status.
//!
//! # KV Maps (created by provision.ts before first run)
//!
//! - `z:<tid>:secrets`            — mock provider API key
//! - `z:<tid>:eligibility`        — PII-FREE eligibility records (recipient_did,
//!                                  region_code, income_bracket) + `_index`.
//!                                  This is the ONLY recipient data the contract reads.
//! - `z:<tid>:policy`             — disbursement policy
//! - `z:<tid>:disbursed-<period>` — deduplication ledger
//! - `z:<tid>:audit`              — audit entries (no PII)
//!
//! PII (bank account, legal name, NIK) is NOT stored in any contract-read map.
//! It lives in each recipient's own T3N user profile and is resolved only via
//! `{{profile.*}}` placeholders inside the enclave during `execute-disbursement`.
#![warn(clippy::style, missing_debug_implementations)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

pub const CONTRACT_VERSION: &str = "0.2.1";

wit_bindgen::generate!({
    world: "tenant-bansos",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod eligibility;
mod batch;
mod disburse;

/// Helper: build the full KV map name from tenant DID bytes.
#[cfg(target_arch = "wasm32")]
pub(crate) fn map_name(tid_bytes: &[u8], tail: &str) -> alloc::string::String {
    alloc::format!("z:{}:{}", hex::encode(tid_bytes), tail)
}

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::tenant_bansos::contracts::Guest for Component {
    fn check_eligibility(
        req: exports::z::tenant_bansos::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("check-eligibility: missing input")?;
        eligibility::check_eligibility(&input)
    }

    fn prepare_batch(
        req: exports::z::tenant_bansos::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("prepare-batch: missing input")?;
        batch::prepare_batch(&input)
    }

    fn execute_disbursement(
        req: exports::z::tenant_bansos::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("execute-disbursement: missing input")?;
        disburse::execute_disbursement(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3, "CONTRACT_VERSION must be MAJOR.MINOR.PATCH");
        for part in parts {
            assert!(part.parse::<u32>().is_ok(), "each part must be a number");
        }
    }

    #[test]
    fn contract_version_is_v0_2_1() {
        assert_eq!(CONTRACT_VERSION, "0.2.1");
    }
}
