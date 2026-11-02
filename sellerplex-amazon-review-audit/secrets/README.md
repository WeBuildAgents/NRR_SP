# Workflow token

`workflow-token.txt` is the local secret consumed by the submission script.

For each authorized Codex or Claude Code workstation:

1. Copy `workflow-token.example.txt` to `workflow-token.txt` if the file is absent.
2. Replace the placeholder with the current token on a single line, without quotes.
3. Keep the real file out of Git, chat, tickets, reports, screenshots, and logs.
4. Ask a SellerPlex administrator for the current token through an approved secret-sharing channel.

The real token file is intentionally listed in the skill's `.gitignore`.

