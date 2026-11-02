#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , historyArg, contextArg, outputArg] = process.argv;
if (!historyArg || !contextArg || !outputArg) {
  console.error('Usage: node scripts/build-report-input.mjs <history.json> <context.json> <output.json>');
  process.exit(1);
}

const history = JSON.parse(readFileSync(resolve(historyArg), 'utf8'));
const context = JSON.parse(readFileSync(resolve(contextArg), 'utf8'));
if (!history.ok || !Array.isArray(history.reviews)) throw new Error('History input must be a successful audit-data query response.');

const strongCategories = new Set([
  'SELLER_CUSTOMER_SERVICE_ONLY','ORDER_OR_RETURN_ONLY','SHIPPING_PACKAGING_ONLY','SHIPPING_COST_OR_SPEED_ONLY',
  'UNSUPPORTED_LANGUAGE','SPAM_REPETITIVE_OR_GIBBERISH','PRIVATE_INFORMATION','PROFANITY_HARASSMENT_OR_THREAT',
  'HATE_SPEECH','SEXUALLY_EXPLICIT_CONTENT','EXTERNAL_LINK','ADVERTISEMENT_OR_PROMOTION','CONFLICT_OF_INTEREST',
  'COMPENSATED_OR_INCENTIVIZED_REVIEW','PLAGIARISM_INFRINGEMENT_OR_IMPERSONATION','ILLEGAL_ACTIVITY_OR_DANGEROUS_MISUSE',
  'PROHIBITED_MEDICAL_CLAIM'
]);

const reviewDate = (review) => String(review.review_date_text || review.date_iso || '').replace(/^.*\bon\s+/i, '').trim();
const categories = (review) => Array.isArray(review.analysis?.policy_categories) ? review.analysis.policy_categories : [];
const hasStrongCategory = (review) => categories(review).some((category) => strongCategories.has(category));
const actionNow = [];
const secondaryReview = [];
const noAction = [];

for (const review of history.reviews) {
  const analysis = review.analysis || {};
  const confidence = Number(analysis.confidence || 0);
  const isAction = analysis.decision === 'CLEAR_VIOLATION'
    && analysis.recommended_action === 'SEND_TO_HUMAN_REVIEW'
    && analysis.evidence_valid === true
    && confidence >= 0.8
    && !analysis.requires_second_review
    && hasStrongCategory(review);
  const isSecondary = !isAction && (
    !review.analysis
    || analysis.decision === 'ANALYSIS_FAILED'
    || analysis.requires_second_review
    || (['LIKELY_VIOLATION', 'AMBIGUOUS', 'INSUFFICIENT_CONTENT'].includes(analysis.decision) && hasStrongCategory(review))
  );

  const common = {
    id: review.id,
    rating: Number(review.rating),
    date: reviewDate(review),
    verified: Boolean(review.verified),
    title: review.title || '(No title)',
    text: review.text || '',
    url: review.url || '',
  };
  if (isAction) {
    actionNow.push({
      ...common,
      categories: categories(review),
      reason: analysis.explanation || 'Clear policy concern supported by the stored analysis.',
      recommendedAction: 'Send this case to SellerPlex Account Health for human review. Do not report it automatically.',
      likelihood: confidence >= 0.9 ? 'High relative to the audited set' : 'Moderate relative to the audited set',
      suggestedMessage: `Please review Amazon review ${review.id}. Stored policy evidence identifies ${categories(review).join(', ')}. Exact evidence: "${analysis.evidence_excerpt || ''}". No automated report has been submitted.`,
    });
  } else if (isSecondary) {
    secondaryReview.push({
      ...common,
      reason: analysis.explanation || 'The stored analysis is missing, failed, mixed, or insufficient for immediate action.',
      recommendedAction: 'Retain for human policy review. Do not report without additional evidence.',
    });
  } else {
    noAction.push({
      ...common,
      reason: analysis.explanation || 'No evidence-backed Amazon policy violation was established.',
    });
  }
}

const globalRatings = Number(context.globalRatings || history.rating_snapshot?.total_ratings || 0);
const percentages = context.percentages || {};
const requestedStars = history.query?.stars || [1, 2, 3];
const coverageRows = requestedStars.map((star) => ({
  stars: star,
  percentage: Number(percentages[String(star)] || 0),
  estimated: Math.floor(globalRatings * Number(percentages[String(star)] || 0) / 100),
  collected: history.reviews.filter((review) => Number(review.rating ?? review.star_filter) === Number(star)).length,
}));

const coverageStates = (history.coverage_by_star || []).map((row) => row.coverage_status).filter(Boolean);
const derivedCoverageStatus = history.collection_plan?.stars_to_collect?.length
  ? 'INCOMPLETE_BLOCKED'
  : coverageStates.includes('AMAZON_EXHAUSTED_BELOW_BASELINE')
    ? 'AMAZON_EXHAUSTED_BELOW_BASELINE'
    : coverageStates.includes('COMPLETE_EXPOSED_SET')
      ? 'COMPLETE_EXPOSED_SET'
      : 'COMPLETE_DATE_WINDOW';

const output = {
  meta: {
    requestedAsin: context.requestedAsin || history.query.asin,
    canonicalAsin: context.canonicalAsin || history.query.asin,
    product: context.product || history.query.product || history.query.asin,
    marketplace: context.marketplace || 'Amazon.com',
    reviewedAt: context.reviewedAt || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
    dateWindow: context.dateWindow || `${history.query.since_date} – ${history.query.until_date}`,
  },
  summary: {
    reviewed: history.reviews.length,
    actNow: actionNow.length,
    secondary: secondaryReview.length,
    noAction: noAction.length,
  },
  coverage: {
    globalRatings,
    status: context.coverageStatus || derivedCoverageStatus,
    note: context.coverageNote || 'Stored reviews and newly ingested reviews were reconciled through the SellerPlex n8n workflow. Histogram estimates are conservative coverage baselines.',
    rows: coverageRows,
  },
  actionNow,
  secondaryReview,
  noAction,
  workflowReconciliation: context.workflowReconciliation || [
    `${history.summary?.stored_reviews_in_window ?? history.reviews.length} reviews were loaded from the merged Postgres history for the requested window.`,
    `${(history.collection_plan?.stars_from_history || []).length} requested star filters were satisfied by recorded history; ${(history.collection_plan?.stars_to_collect || []).length} required acquisition.`,
    `${history.summary?.unclassified_or_failed ?? 0} reviews had missing or failed stored analysis and were routed conservatively.`,
  ],
  sources: context.sources || [
    { label: 'Amazon Community Guidelines', url: 'https://digprjsurvey.amazon.com/csad/help/node/GLHXEX85MENUE4XF' },
  ],
  limitations: context.limitations || [
    'Amazon global ratings can include ratings without text, variants, regions, and Amazon weighting.',
    'Collection coverage represents the written reviews exposed to the authorized browser session, not Amazon internal inventory.',
    'This report is an operational recommendation; Amazon alone decides whether a review is removed.',
  ],
};

writeFileSync(resolve(outputArg), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(resolve(outputArg));

