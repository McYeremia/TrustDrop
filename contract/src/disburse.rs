//! execute_disbursement: call payment provider for each approved recipient.
//!
//! Uses `http-with-placeholders` so PII (bank account, recipient name)
//! is resolved inside the enclave by the host — the contract WASM never
//! holds plaintext PII. Each successful disbursement is recorded in the
//! dedup ledger and audit log.

#[derive(serde::Deserialize)]
pub struct ExecuteDisbursementReq {
    pub period: String,
    pub approved: alloc::vec::Vec<ApprovedEntry>,
    pub provider_url: String,
}

#[derive(serde::Deserialize)]
pub struct ApprovedEntry {
    pub recipient_did: String,
    pub amount: f64,
}

#[derive(serde::Serialize)]
pub struct ExecuteDisbursementResp {
    pub results: alloc::vec::Vec<DisbursementResult>,
    pub success_count: u32,
    pub fail_count: u32,
}

#[derive(serde::Serialize)]
pub struct DisbursementResult {
    pub recipient_did: String,
    pub status: String,
    pub tx_id: String,
}

/// Audit entry written to the audit KV map (no PII).
#[derive(serde::Serialize)]
struct AuditEntry {
    pub recipient_did: String,
    pub amount: f64,
    pub timestamp: u64,
    pub policy_compliant: bool,
    pub run_id: String,
    pub status: String,
}

pub fn execute_disbursement(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: ExecuteDisbursementReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("execute-disbursement: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let resp = execute_disbursement_wasm(req)?;
        serde_json::to_vec(&resp).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = req;
        Err("execute_disbursement is only implemented on the wasm32 target".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{http_with_placeholders as hwp, kv_store, logging},
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
fn execute_disbursement_wasm(req: ExecuteDisbursementReq) -> Result<ExecuteDisbursementResp, String> {
    use serde_json::json;

    let tid = tenant_context::tenant_did();
    let dedup_map = crate::map_name(&tid, &alloc::format!("disbursed-{}", req.period));
    let audit_map = crate::map_name(&tid, "audit");
    let timestamp = tenant_context::cluster_timestamp_secs();
    let seq = tenant_context::seq_no();
    let run_id = alloc::format!("run-{}-{}", req.period, seq);

    let _ = logging::info(&alloc::format!(
        "execute-disbursement: processing {} recipients via {}",
        req.approved.len(), req.provider_url
    ));

    let mut results = alloc::vec::Vec::new();
    let mut success_count = 0u32;
    let mut fail_count = 0u32;

    for entry in &req.approved {
        // Double-check dedup (belt-and-suspenders — prepare-batch already checked)
        let already = kv_store::get(&dedup_map, entry.recipient_did.as_bytes())
            .map_err(|e| alloc::format!("kv read dedup: {e}"))?;
        if already.is_some() {
            let _ = logging::info(&alloc::format!(
                "execute-disbursement: {} already disbursed — skipping",
                entry.recipient_did
            ));
            results.push(DisbursementResult {
                recipient_did: entry.recipient_did.clone(),
                status: "SKIPPED_DUPLICATE".to_string(),
                tx_id: "".to_string(),
            });
            fail_count += 1;
            continue;
        }

        // Build the payment request body using placeholders.
        // The host resolves {{profile.*}} from the BOUND user's profile
        // inside the enclave — PII never enters WASM memory.
        //
        // CONFIRMED (Temuan #2, 2026-06-13): {{profile.*}} resolves ONLY from
        // the bound user's profile (single subject); the host hard-gates the
        // `profile` namespace. There is no KV-indexed placeholder. Therefore
        // execute-disbursement must be invoked PER RECIPIENT, with that
        // recipient as the bound user context (their own T3N profile + grant),
        // so {{profile.bank_account}} resolves to the correct recipient.
        // `approved` should carry exactly one entry per invocation in this model.
        let payment_body = json!({
            "recipient_did": entry.recipient_did,
            "amount": entry.amount,
            "currency": "IDR",
            "bank_account": "{{profile.bank_account}}",
            "recipient_name": "{{profile.first_name}}",
            "period": req.period,
            "run_id": run_id,
        });

        let resp = hwp::call(&hwp::Request {
            method: hwp::Verb::Post,
            url: alloc::format!("{}/api/mock-provider", req.provider_url),
            headers: Some(alloc::vec![
                ("Content-Type".to_string(), "application/json".to_string()),
            ]),
            payload: Some(serde_json::to_vec(&payment_body).map_err(|e| e.to_string())?),
        });

        match resp {
            Ok(http_resp) => {
                if http_resp.code == 200 || http_resp.code == 201 {
                    // Parse tx_id from provider response
                    let provider_resp: serde_json::Value =
                        serde_json::from_slice(&http_resp.payload).unwrap_or(json!({}));
                    let tx_id = provider_resp["tx_id"]
                        .as_str()
                        .unwrap_or("unknown")
                        .to_string();

                    // Mark as disbursed in dedup ledger
                    let dedup_value = json!({
                        "amount": entry.amount,
                        "tx_id": tx_id,
                        "timestamp": timestamp,
                        "run_id": run_id,
                    });
                    let _ = kv_store::put(
                        &dedup_map,
                        entry.recipient_did.as_bytes(),
                        &serde_json::to_vec(&dedup_value).unwrap_or_default(),
                    );

                    // Write audit entry (no PII)
                    let audit = AuditEntry {
                        recipient_did: entry.recipient_did.clone(),
                        amount: entry.amount,
                        timestamp,
                        policy_compliant: true,
                        run_id: run_id.clone(),
                        status: "SUCCESS".to_string(),
                    };
                    let audit_key = alloc::format!("{}:{}", run_id, entry.recipient_did);
                    let _ = kv_store::put(
                        &audit_map,
                        audit_key.as_bytes(),
                        &serde_json::to_vec(&audit).unwrap_or_default(),
                    );

                    let _ = logging::info(&alloc::format!(
                        "execute-disbursement: {} → SUCCESS tx_id={}",
                        entry.recipient_did, tx_id
                    ));

                    results.push(DisbursementResult {
                        recipient_did: entry.recipient_did.clone(),
                        status: "SUCCESS".to_string(),
                        tx_id,
                    });
                    success_count += 1;
                } else {
                    let _ = logging::error(&alloc::format!(
                        "execute-disbursement: {} → provider HTTP {}",
                        entry.recipient_did, http_resp.code
                    ));
                    results.push(DisbursementResult {
                        recipient_did: entry.recipient_did.clone(),
                        status: alloc::format!("PROVIDER_ERROR_{}", http_resp.code),
                        tx_id: "".to_string(),
                    });
                    fail_count += 1;
                }
            }
            Err(e) => {
                let error_msg = format_http_error(e);
                let _ = logging::error(&alloc::format!(
                    "execute-disbursement: {} → {}",
                    entry.recipient_did, error_msg
                ));
                results.push(DisbursementResult {
                    recipient_did: entry.recipient_did.clone(),
                    status: alloc::format!("ERROR: {}", error_msg),
                    tx_id: "".to_string(),
                });
                fail_count += 1;
            }
        }
    }

    let _ = logging::info(&alloc::format!(
        "execute-disbursement: done — {} success, {} failed",
        success_count, fail_count
    ));

    Ok(ExecuteDisbursementResp {
        results,
        success_count,
        fail_count,
    })
}

/// Render a typed `http-with-placeholders` error without leaking PII.
#[cfg(target_arch = "wasm32")]
fn format_http_error(e: hwp::HttpError) -> alloc::string::String {
    match e {
        hwp::HttpError::EgressDenied(host) => alloc::format!("egress denied for host {host}"),
        hwp::HttpError::PlaceholderDenied(marker) => {
            alloc::format!("placeholder not permitted: {marker}")
        }
        hwp::HttpError::PlaceholderUnknown(field) => {
            alloc::format!("user profile missing field: {field}")
        }
        hwp::HttpError::PlaceholderNoUserContext => {
            "no user context bound for placeholder resolution".to_string()
        }
        hwp::HttpError::UpstreamError(reason) => alloc::format!("upstream: {reason}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn execute_disbursement_non_wasm_returns_err() {
        let input = serde_json::to_vec(&serde_json::json!({
            "period": "2026-06",
            "approved": [{ "recipient_did": "did:t3n:abc", "amount": 500000.0 }],
            "provider_url": "http://localhost:3000"
        }))
        .unwrap();
        let result = execute_disbursement(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("only implemented on the wasm32 target"));
    }

    #[test]
    fn execute_disbursement_bad_input_returns_err() {
        let result = execute_disbursement(b"not json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("bad input"));
    }
}
