# SellerPlex report context

`scripts/build-report-input.mjs` combines the final history response with a small context JSON captured from the current product page.

```json
{
  "requestedAsin": "B000000000",
  "canonicalAsin": "B000000001",
  "product": "Product name",
  "marketplace": "Amazon.com",
  "reviewedAt": "November 2, 2026",
  "dateWindow": "November 2, 2025 – November 2, 2026",
  "globalRatings": 42,
  "percentages": {"1": 11, "2": 8, "3": 9, "4": 15, "5": 57},
  "coverageStatus": "COMPLETE_DATE_WINDOW",
  "coverageNote": "Coverage explanation grounded in the final run.",
  "workflowReconciliation": ["Evidence-based observation."],
  "limitations": ["Known limitation."],
  "sources": [
    {"label": "Amazon Community Guidelines", "url": "https://digprjsurvey.amazon.com/csad/help/node/GLHXEX85MENUE4XF"}
  ]
}
```

The builder independently floors each histogram estimate. It maps only high-confidence `CLEAR_VIOLATION` analyses with valid evidence and strong policy categories to Action now. Likely, mixed, failed, or missing analyses remain in Secondary review. Legitimate product feedback remains in No action recommended.

