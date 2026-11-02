# n8n workflow artifacts

This folder contains the evidence and recovery material for the bearer-token gate and cache-first history endpoint deployed on 2026-11-02.

- `workflow-pAeVOR9Udi1pc9Gp.before-token-gate-20261102.json`: rollback snapshot taken before the authentication change.
- `workflow-pAeVOR9Udi1pc9Gp.token-gate.update.json`: minimal update payload sent to n8n.
- `workflow-pAeVOR9Udi1pc9Gp.token-gate.put-response.json`: provider response to the successful update.
- `workflow-pAeVOR9Udi1pc9Gp.after-token-gate-20261102.json`: authoritative workflow export after deployment.
- `workflow-pAeVOR9Udi1pc9Gp.auth-test-executions.sanitized.json`: sanitized evidence from the authenticated probe. The raw bearer token was removed before archival.
- `workflow-pAeVOR9Udi1pc9Gp.before-history-query-20261102.json`: rollback snapshot taken before the history and coverage endpoint was added.
- `workflow-pAeVOR9Udi1pc9Gp.history-query.update.json`: minimal workflow update containing the audit-data webhook, Postgres history query, and coverage ledger branch.
- `workflow-pAeVOR9Udi1pc9Gp.history-query.put-response.json`: provider response to the successful cache-first update.
- `workflow-pAeVOR9Udi1pc9Gp.after-history-query-20261102.json`: authoritative active workflow export after both changes.
- `cache-first-validation-20261102.json`: sanitized acceptance evidence for a complete cache hit, a partially extended window, and the final SellerPlex report.

The live workflow remained active after both deployments. Missing and invalid tokens returned HTTP 401. The authenticated history probe returned stored reviews without browser or AI work. Coverage is persisted in `amazon_review_collection_windows`, allowing an encompassing completed window to prevent review recollection in future audits.

