---
name: sellerplex-amazon-review-audit
description: Collect and audit Amazon 1-3-star product reviews for SellerPlex through a user-authorized browser, submit raw HTML to the authenticated n8n review workflow, and report coverage and moderation candidates. Use for negative-review compliance audits, backfills, and incremental checks. Do not use to report or remove reviews automatically, manipulate ratings, or bypass access controls.
---

# SellerPlex Amazon Review Audit

Run the SellerPlex negative-review audit while keeping acquisition, parsing, classification, and human action separate.

## Required inputs

- ASIN and Amazon marketplace.
- Inclusive date cutoff or time window.
- Star filters, normally 1, 2, and 3.
- A user-authorized browser session.

Use only the stars requested by the user. Never collect 4- or 5-star reviews for this workflow unless explicitly requested.

## Authentication

The live n8n ingestion webhook requires a bearer token.

- Read the token from `secrets/workflow-token.txt`.
- Never display, quote, summarize, log, or paste the token into chat.
- Never place the token in a URL, query parameter, HTML body, report, or generated artifact.
- If the file is absent, empty, or contains a placeholder, stop before submission and ask a SellerPlex administrator to provision it securely.
- Use `scripts/submit-review-html.ps1`; it reads the token and sends it in the `Authorization` header.

For the exact payload and response contract, read [references/workflow-contract.md](references/workflow-contract.md).

## Collection workflow

1. Open the requested product in the authorized browser and record any canonical-ASIN redirect.
2. Capture the global rating count and displayed percentages for all five stars.
3. Use `scripts/estimate-rating-distribution.mjs` to calculate the conservative per-star baseline with independent floor rounding.
4. For each requested star independently, open the filtered review list sorted newest first.
5. Verify the visible filter and verify that every review card on the page matches the requested star.
6. Save the rendered HTML before parsing or transforming it.
7. Submit each page with `scripts/submit-review-html.ps1`, including ASIN, star, source URL, page number, cutoff, and a unique submission ID.
8. Advance only through Amazon's enabled next-page control. Stop when the cutoff is crossed, pagination ends, or a genuine block occurs.

If Amazon presents a CAPTCHA or another challenge, leave it to the user to complete in the authorized browser. Do not bypass it.

## Submission example

```powershell
.\scripts\submit-review-html.ps1 `
  -HtmlPath "C:\path\page-1.html" `
  -Asin "B00TRFLWFG" `
  -Star 1 `
  -SourceUrl "https://www.amazon.com/portal/customer-reviews/B00TRFLWFG/?filterByStar=one_star&reviewerType=all_reviews" `
  -PageNumber 1 `
  -SinceDate "2026-10-01"
```

The script defaults external notification to disabled. Enable notification only when the user explicitly requests it.

## Verification

Accept a page only when:

- the response is authenticated and `ok` is true;
- `html_saved` is true;
- `parse_status` is successful;
- the returned ASIN and star match the requested values;
- rating mismatches and out-of-window rejections are understood;
- page N is not a duplicate of page N-1.

The workflow deduplicates reviews and runs AI classification only for new or materially changed review content.

## Coverage and decisions

Treat histogram estimates as ratings baselines, not as counts of retrievable written reviews. Report collected written reviews separately.

The workflow's moderation results support a human Account Health queue. Do not automatically click Amazon's Report control or claim that Amazon will remove a review. For manual QA of candidate decisions, read [references/policy-decision-rules.md](references/policy-decision-rules.md).

Report:

- requested and canonical ASIN;
- marketplace and date range;
- pages and unique reviews per requested star;
- conservative histogram estimate per star;
- termination reason and coverage status;
- new or changed reviews classified;
- candidates for Account Health review;
- browser and AI cost telemetry when available;
- authentication failures, CAPTCHA events, blocks, and unresolved gaps.

