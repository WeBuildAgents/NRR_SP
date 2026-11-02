# SellerPlex Amazon Review Audit

This directory is the canonical, self-contained home for the internal Amazon review audit skill.

## Structure

- `SKILL.md`: Codex skill instructions and operating workflow.
- `agents/`: skill presentation metadata.
- `config/`: production webhook configuration.
- `scripts/`: rating estimation and authenticated HTML submission utilities.
- `references/`: webhook contract and manual compliance decision rules.
- `secrets/`: local bearer-token provisioning; the real token is ignored by Git.
- `artifacts/n8n/`: current workflow exports, deployment payload, rollback snapshot, and sanitized verification evidence.

## Security

Never distribute `secrets/workflow-token.txt` through Git, chat, tickets, reports, screenshots, or ordinary archives. Provision it separately on each authorized workstation using an approved secret-sharing channel.

The n8n workflow stores only the SHA-256 digest used by the Code-node authorization gate. Raw execution evidence must be sanitized before it is retained in `artifacts/`.

## Live workflow

- Workflow ID: `pAeVOR9Udi1pc9Gp`
- Workflow name: `Amazon Negative Review Compliance - Collector & Human Review Queue`
- Webhook URL: see `config/workflow-url.txt`

