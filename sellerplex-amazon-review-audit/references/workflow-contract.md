# Authenticated HTML ingestion contract

## Endpoint

Read the production URL from `config/workflow-url.txt`.

Send:

- method: `POST`;
- header: `Authorization: Bearer <token>`;
- content type: `text/html; charset=utf-8`;
- body: rendered Amazon review-page HTML.

Never put the token in the URL, query string, HTML body, submission ID, or logs.

## Required query parameters

- `asin`: 10-character ASIN.
- `star_filter`: `1`, `2`, or `3`.
- `source_url`: HTTPS `amazon.com` URL containing the ASIN and matching `filterByStar`.
- `submission_id`: unique 8-160 character identifier.

## Optional query parameters

- `page_number`: defaults to 1.
- `since_date`: inclusive `YYYY-MM-DD` cutoff.
- `client_id`, `brand_id`, and `brand_name`.
- `notify`: defaults to `false`; only enable by explicit user request.

## Responses

- `200`: authenticated request processed; inspect `ok`, `html_saved`, `parse_status`, review counts, candidates, and telemetry.
- `401`: missing or invalid bearer token.
- workflow execution error: invalid metadata, malformed/short HTML, CAPTCHA content, ASIN/filter mismatch, database failure, or downstream classification failure.

The workflow saves raw HTML, deduplicates reviews, and classifies only new or materially changed content.

# Authenticated history and coverage contract

## Endpoint

Read the production URL from `config/audit-data-url.txt`. Send JSON with the same bearer token in the `Authorization` header.

## Query history

Send:

```json
{
  "action": "query",
  "asin": "B00TRFLWFG",
  "marketplace": "amazon.com",
  "stars": [1, 2, 3],
  "since_date": "2025-10-27",
  "until_date": "2026-10-27"
}
```

The response returns `reviews`, persisted `analysis`, `rating_snapshot`, `coverage_windows`, `coverage_by_star`, `collection_plan`, `summary`, and related job evidence. Treat `collection_plan.stars_to_collect` as the only review-acquisition scope. When it is empty, do not browse review pages or submit HTML.

## Record coverage

Send `action: "record_coverage"` with the requested window and one row per completed star. Valid states are `COMPLETE_EXPOSED_SET`, `COMPLETE_DATE_WINDOW`, `AMAZON_EXHAUSTED_BELOW_BASELINE`, and `INCOMPLETE_BLOCKED`. Only the first three can satisfy a future cache hit.

Coverage recording does not create or classify reviews. It stores auditable evidence that a star/window was completed or blocked.

