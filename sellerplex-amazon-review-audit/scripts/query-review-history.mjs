#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--help' || key === '-h') return { help: true };
    if (!key.startsWith('--')) fail(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`Missing value for ${key}`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function readConfig(relativePath, label) {
  const path = join(skillRoot, relativePath);
  if (!existsSync(path)) fail(`${label} is missing.`);
  const value = readFileSync(path, 'utf8').trim();
  if (!value || /^REPLACE_/i.test(value)) fail(`${label} is not provisioned.`);
  return value;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write('Usage: node scripts/query-review-history.mjs --asin <ASIN> [--stars 1,2,3] [--since-date YYYY-MM-DD] [--until-date YYYY-MM-DD] [--product name] [--output history.json]\n');
  process.exit(0);
}

const asin = String(args.asin || '').trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(asin)) fail('--asin must contain exactly 10 letters or digits.');
const stars = String(args.stars || '1,2,3').split(',').map(Number);
if (!stars.length || stars.some((star) => ![1, 2, 3].includes(star))) fail('--stars must contain only 1, 2, and/or 3.');

const today = new Date();
const untilDate = args['until-date'] || today.toISOString().slice(0, 10);
const sinceDefault = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
const sinceDate = args['since-date'] || sinceDefault;
const validIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
if (!validIsoDate(sinceDate) || !validIsoDate(untilDate) || sinceDate > untilDate) {
  fail('Date values must use YYYY-MM-DD and form a valid inclusive window.');
}

const token = readConfig(join('secrets', 'workflow-token.txt'), 'Workflow token');
const endpoint = readConfig(join('config', 'audit-data-url.txt'), 'Audit-data endpoint');
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'query', asin, marketplace: 'amazon.com', stars, since_date: sinceDate, until_date: untilDate, product: args.product || null }),
});
const text = await response.text();
if (!response.ok) fail(response.status === 401 ? 'Workflow authentication failed.' : `History query returned HTTP ${response.status}: ${text.slice(0, 1000)}`);

let data;
try { data = JSON.parse(text); } catch { fail('History query did not return valid JSON.'); }
const rendered = `${JSON.stringify(data, null, 2)}\n`;
if (args.output) writeFileSync(resolve(args.output), rendered, 'utf8');
else process.stdout.write(rendered);

