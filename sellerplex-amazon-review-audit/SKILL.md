---
name: sellerplex-amazon-review-audit
description: Research an Amazon ASIN, reuse previously collected 1-3-star reviews from SellerPlex history, collect and ingest only uncovered reviews, and generate the final English SellerPlex HTML action report. Use for negative-review compliance audits, backfills, incremental checks, and Account Health reports in Codex or Claude. Do not use to report or remove reviews automatically, manipulate ratings, or bypass access controls.
---

# SellerPlex Amazon Review Audit

Run the SellerPlex negative-review audit while keeping acquisition, parsing, classification, and human action separate.

## Required outcome

Treat an ASIN research request as an end-to-end audit unless the user narrows the scope:

1. inspect stored history before browsing review pages;
2. reuse stored reviews and stored analyses inside the requested window;
3. collect only stars or date windows not already covered;
4. ingest new HTML through n8n so deduplication and classification remain authoritative;
5. query the merged dataset again;
6. generate the final English SellerPlex HTML action report.

Read [references/end-to-end-flow.md](references/end-to-end-flow.md) before executing an ASIN audit or report request. It defines the cache-first decision rules, coverage ledger, and completion contract.

## Agent compatibility

This package follows the open Agent Skills `SKILL.md` format and is the shared source of truth for Codex and Claude Code.

- In Codex, invoke it as `$sellerplex-amazon-review-audit`.
- In Claude Code, invoke it as `/sellerplex-amazon-review-audit`.
- Use the browser or computer-control capability available in the host agent. Do not assume a platform-specific browser API.
- If the host cannot access an authorized interactive browser, accept rendered HTML supplied by the user and start at validation and submission. Never replace missing browser access with an unauthorized scraper.

For installation paths and platform-specific metadata, read [references/platform-setup.md](references/platform-setup.md).

## Required inputs

- ASIN. The live workflow currently supports `amazon.com`.
- Inclusive date cutoff or time window.
- Star filters, normally 1, 2, and 3.
- A user-authorized browser session or rendered Amazon review-page HTML only when the history query identifies an uncovered star/window or current product metadata is missing.

If the user omits the star filters, use 1, 2, and 3. If the user omits the date window, use the previous 365 days through the current date.

Use only the stars requested by the user. Never collect 4- or 5-star reviews for this workflow unless explicitly requested.

## Authentication

The live n8n ingestion webhook requires a bearer token.

- Read the token from `secrets/workflow-token.txt`.
- Never display, quote, summarize, log, or paste the token into chat.
- Never place the token in a URL, query parameter, HTML body, report, or generated artifact.
- If the file is absent, empty, or contains a placeholder, stop before submission and ask a SellerPlex administrator to provision it securely.
- Prefer the cross-platform `scripts/submit-review-html.mjs`; it reads the token and sends it in the `Authorization` header.
- `scripts/submit-review-html.ps1` is retained as a Windows PowerShell alternative.

For the exact payload and response contract, read [references/workflow-contract.md](references/workflow-contract.md).

## Collection workflow

1. Run `scripts/query-review-history.mjs` for the ASIN, requested stars, and date window before opening filtered review pages.
2. If `collection_plan.stars_to_collect` is empty, do not open a filtered review page and do not submit HTML. Continue directly to report preparation with `reviews` and their persisted `analysis` values.
3. Reuse `rating_snapshot` and stored product metadata when present. Open only the product page when current metadata is missing or the user requests a current snapshot; this is not review recollection.
4. Record any canonical-ASIN redirect, product name, global rating count, and displayed percentages for all five stars. Use `scripts/estimate-rating-distribution.mjs` to calculate the conservative per-star baseline with independent floor rounding.
5. Skip stars listed in `collection_plan.stars_from_history`; their stored reviews are the authoritative input for this audit.
6. For each star in `collection_plan.stars_to_collect`, open the filtered review list sorted newest first. Use `collection_plan.known_review_ids_by_star` and `coverage_by_star` to avoid resubmitting already stored reviews. A window extension may require navigating through known pages, but those pages are not new collection inputs.
7. Verify the visible filter and verify that every review card on the page matches the requested star.
8. Save the rendered HTML before parsing or transforming it. Do not submit a page that contains no new or materially changed review and exists only to confirm a known boundary.
9. Submit pages containing new or changed reviews with `scripts/submit-review-html.mjs` or the PowerShell alternative.
10. Advance only through Amazon's enabled next-page control. Stop when the cutoff, a recorded boundary, pagination end, or a genuine block is reached.
11. Record the resulting per-star coverage with `scripts/record-review-coverage.mjs`.
12. Query history again so the report uses the merged Postgres dataset rather than browser memory.

If Amazon presents a CAPTCHA or another challenge, leave it to the user to complete in the authorized browser. Do not bypass it.

## Submission example

```bash
node scripts/submit-review-html.mjs \
  --html "./page-1.html" \
  --asin "B00TRFLWFG" \
  --star 1 \
  --source-url "https://www.amazon.com/portal/customer-reviews/B00TRFLWFG/?filterByStar=one_star&reviewerType=all_reviews" \
  --page-number 1 \
  --since-date "2026-10-01"
```

Both submission scripts default external notification to disabled. Enable notification only when the user explicitly requests it.

## Verification

Accept a page only when:

- the response is authenticated and `ok` is true;
- `html_saved` is true;
- `parse_status` is successful;
- the returned ASIN and star match the requested values;
- rating mismatches and out-of-window rejections are understood;
- page N is not a duplicate of page N-1.

The workflow deduplicates reviews and runs AI classification only for new or materially changed review content.

## Final SellerPlex report

Create `report-context.json` from stored metadata and, only where needed, the current product page. Follow [references/report-input-schema.md](references/report-input-schema.md). The final `history-final.json` must be the response from the post-ingestion history query, or the original history response when the request was a complete cache hit.

Run:

```bash
node scripts/build-report-input.mjs history-final.json report-context.json report-input.json
node scripts/generate-report.mjs report-input.json sellerplex-amazon-review-action-report-<asin>-<date>.html
```

The report must be self-contained, English, responsive, printable, and use SellerPlex visual identity. It must separate Action now, Secondary review, and No action recommended. The no-action table must contain the full review text and direct review link. The report recommends actions but never performs them.

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

