# n8n workflow artifacts

This folder contains the evidence and recovery material for the bearer-token gate deployed on 2026-11-02.

- `workflow-pAeVOR9Udi1pc9Gp.before-token-gate-20261102.json`: rollback snapshot taken before the authentication change.
- `workflow-pAeVOR9Udi1pc9Gp.token-gate.update.json`: minimal update payload sent to n8n.
- `workflow-pAeVOR9Udi1pc9Gp.token-gate.put-response.json`: provider response to the successful update.
- `workflow-pAeVOR9Udi1pc9Gp.after-token-gate-20261102.json`: authoritative workflow export after deployment.
- `workflow-pAeVOR9Udi1pc9Gp.auth-test-executions.sanitized.json`: sanitized evidence from the authenticated probe. The raw bearer token was removed before archival.

The live workflow remained active after deployment. Missing and invalid tokens returned HTTP 401; the valid-token probe reached `Code - Normalize Raw HTML` and stopped on the intentionally short HTML body before parsing or AI classification.

