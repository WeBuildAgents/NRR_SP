# Codex and Claude Code setup

The skill uses the open Agent Skills format: one directory containing `SKILL.md` and its supporting files. The operational instructions, scripts, references, configuration, and secret-file convention are shared by both agents.

## Discovery paths

Install the same `sellerplex-amazon-review-audit` directory in the appropriate location:

| Agent | Project scope | Personal scope | Invocation |
|---|---|---|---|
| Codex | `.codex/skills/sellerplex-amazon-review-audit/` | `~/.codex/skills/sellerplex-amazon-review-audit/` | `$sellerplex-amazon-review-audit` |
| Claude Code | `.claude/skills/sellerplex-amazon-review-audit/` | `~/.claude/skills/sellerplex-amazon-review-audit/` | `/sellerplex-amazon-review-audit` |

Use a copy or directory link appropriate to the operating system. A link keeps one canonical source; a copy is simpler but must be updated when the source changes.

`agents/openai.yaml` is optional Codex-facing UI metadata. Claude Code does not need it and should ignore it as an ordinary supporting file. Do not add Claude-only frontmatter to `SKILL.md`; keeping only the standard `name` and `description` fields preserves portability.

## Runtime requirements

- Node.js 18 or newer for the cross-platform utilities.
- Network access to the configured n8n webhook.
- A locally provisioned `secrets/workflow-token.txt` containing the current bearer token.
- A user-authorized browser/computer-control capability, or rendered Amazon review HTML supplied by the user.
- Windows PowerShell only when choosing the optional `.ps1` submission client.

Run the local compatibility check without contacting Amazon or n8n:

```bash
node scripts/check-setup.mjs
```

The check reports only configuration state. It never prints the token.

## Browser capability differences

Agent installations do not all expose the same browser controls. Follow the acquisition outcome instead of a specific tool name:

1. Use an authorized interactive browser when the host exposes one.
2. Save the rendered review-page HTML before transformation.
3. If no browser capability is available, ask the user for the saved HTML and continue with validation and submission.
4. Stop for user completion of CAPTCHA or other human-verification challenges.
5. Never install or invent an access-control bypass merely to make the skill run on a different host.

