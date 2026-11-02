# End-to-end ASIN audit

## Default contract

An ASIN research request produces a final SellerPlex HTML action report. Default to Amazon.com, stars 1-3, and the previous 365 days when the user does not specify them.

The source of truth for review content and analyses is Postgres through the authenticated n8n audit-data endpoint. Browser state is acquisition evidence, not report state.

## Cache-first sequence

1. Query history with `scripts/query-review-history.mjs` before opening filtered review pages.
2. Use `reviews` from the response for every previously stored review in the requested date window.
3. Use `collection_plan.stars_from_history` without review-page acquisition.
4. Acquire only `collection_plan.stars_to_collect`.
5. When `stars_to_collect` is empty, make zero review-page requests and zero ingestion calls. Generate the report from Postgres history.
6. For a partially covered star, use `known_review_ids_by_star` and `coverage_by_star` as incremental boundaries. Navigating through known pages may be necessary to reach an uncovered older slice, but known pages must not be resubmitted merely to rebuild the dataset.
7. Send only pages that contain at least one new or materially changed review. The n8n ingestion path still enforces deduplication and classifies only new or changed content.
8. Record the final coverage state with `scripts/record-review-coverage.mjs`.
9. Query history again. Generate the report only from this merged response plus stored or current product/histogram metadata.

Never replace stored reviews with a fresh browser-only dataset. Never reclassify unchanged stored reviews in the host agent when a persisted n8n analysis exists.

The audit-data response is the execution plan:

- `reviews`: persisted reviews inside the requested inclusive date window;
- `coverage_by_star`: coverage evidence and stored counts for every requested star;
- `collection_plan.stars_from_history`: stars fully satisfied by a recorded encompassing window;
- `collection_plan.stars_to_collect`: stars with an uncovered or blocked slice;
- `collection_plan.known_review_ids_by_star`: IDs already persisted and available as incremental boundaries.

## Coverage states

Record one state per requested star and date window:

- `COMPLETE_EXPOSED_SET`: pagination ended cleanly and all written reviews exposed to the session were processed.
- `COMPLETE_DATE_WINDOW`: the inclusive cutoff was crossed without a page gap.
- `AMAZON_EXHAUSTED_BELOW_BASELINE`: pagination ended below the conservative histogram estimate; stored coverage is complete for the exposed set, not Amazon's internal inventory.
- `INCOMPLETE_BLOCKED`: CAPTCHA, access denial, malformed page, contradictory pagination, or another block prevented completion.

Only the first three states satisfy a future cache hit. An incomplete window remains visible and may require incremental collection, but all reviews already present in `reviews` must still be reused.

Example coverage input:

```json
{
  "asin": "B00TRFLWFG",
  "marketplace": "amazon.com",
  "stars": [1, 2, 3],
  "since_date": "2025-11-02",
  "until_date": "2026-11-02",
  "run_id": "audit-B00TRFLWFG-20261102",
  "coverage": [
    {
      "star": 1,
      "status": "COMPLETE_DATE_WINDOW",
      "termination_reason": "cutoff_reached",
      "pages_captured": 2,
      "unique_written_reviews": 8,
      "known_review_boundary_id": "REVIEW_ID"
    }
  ]
}
```

## Report completion

Before generating the report:

- query the merged history after all authorized ingestion finishes;
- expose any requested star that remains `INCOMPLETE_BLOCKED`;
- place only clear, evidence-backed violations in Action now;
- place likely, mixed, missing-analysis, or uncertain cases in Secondary review;
- preserve legitimate product criticism in No action recommended;
- retain full review text and direct URLs;
- include histogram estimates, written-review counts, coverage status, costs, and limitations;
- never claim that Amazon will remove a review or that the report performed a report action.

