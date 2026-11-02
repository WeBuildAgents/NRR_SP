# SellerPlex Amazon Review Audit

This directory is the canonical, self-contained home for the internal Amazon review audit skill. It follows the open Agent Skills format and can be installed in Codex or Claude Code without maintaining separate instruction copies.

## Compatibility

- Codex project skill: `.codex/skills/sellerplex-amazon-review-audit/`
- Codex personal skill: `~/.codex/skills/sellerplex-amazon-review-audit/`
- Claude Code project skill: `.claude/skills/sellerplex-amazon-review-audit/`
- Claude Code personal skill: `~/.claude/skills/sellerplex-amazon-review-audit/`

The folder contents are identical on both platforms. Prefer copying or linking this canonical directory into the appropriate discovery path instead of maintaining divergent versions. See `references/platform-setup.md`.

## Structure

- `SKILL.md`: platform-neutral Agent Skill instructions and operating workflow.
- `agents/`: optional OpenAI/Codex presentation metadata; Claude Code does not require it.
- `config/`: production webhook configuration.
- `scripts/`: history lookup, coverage recording, HTML ingestion, rating estimation, and SellerPlex report generation.
- `references/`: cache-first workflow, report schema, webhook contract, and manual compliance decision rules.
- `secrets/`: local bearer-token provisioning; the real token is ignored by Git.
- `artifacts/n8n/`: current workflow exports, deployment payload, rollback snapshot, and sanitized verification evidence.

## Security

Never distribute `secrets/workflow-token.txt` through Git, chat, tickets, reports, screenshots, or ordinary archives. Provision it separately on each authorized workstation using an approved secret-sharing channel.

The n8n workflow stores only the SHA-256 digest used by the Code-node authorization gate. Raw execution evidence must be sanitized before it is retained in `artifacts/`.

## Live workflow

- Workflow ID: `pAeVOR9Udi1pc9Gp`
- Workflow name: `Amazon Negative Review Compliance - Collector & Human Review Queue`
- Webhook URL: see `config/workflow-url.txt`
- History and coverage URL: see `config/audit-data-url.txt`

## End-to-end behavior

An ASIN request starts with the authenticated Postgres history query. If the recorded coverage already encompasses the requested star/date window, the skill does not reopen review pages and does not invoke ingestion or classification. It builds the SellerPlex HTML report from the stored reviews and analyses. Only uncovered stars or window slices are acquired and ingested; the merged history response is always the report source of truth.

