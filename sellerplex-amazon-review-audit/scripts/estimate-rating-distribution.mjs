#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const rawInput = process.argv[2] ?? readFileSync(0, 'utf8');
let input;
try {
  input = JSON.parse(rawInput);
} catch {
  fail('Input must be valid JSON.');
}

const total = Number(input.globalRatings);
const percentages = input.percentages ?? {};

if (!Number.isInteger(total) || total < 0) {
  fail('globalRatings must be a non-negative integer.');
}

const stars = [1, 2, 3, 4, 5];
const values = stars.map((star) => Number(percentages[String(star)]));
if (values.some((value) => !Number.isFinite(value) || value < 0)) {
  fail('percentages must contain non-negative numeric values for stars 1 through 5.');
}

const percentageSum = values.reduce((sum, value) => sum + value, 0);
const estimates = values.map((value) => Math.floor((total * value) / 100));
const estimatedTotal = estimates.reduce((sum, value) => sum + value, 0);

const distribution = Object.fromEntries(stars.map((star, index) => [String(star), {
  displayedPercentage: values[index],
  estimatedRatings: estimates[index],
}]));

process.stdout.write(`${JSON.stringify({
  globalRatings: total,
  displayedPercentageSum: percentageSum,
  estimatedRatingsTotal: estimatedTotal,
  unallocatedRoundingResidue: Math.max(0, total - estimatedTotal),
  method: 'independent_floor',
  caveat: 'Coverage baseline only; Amazon ratings are not equivalent to retrievable written reviews.',
  distribution,
}, null, 2)}\n`);

