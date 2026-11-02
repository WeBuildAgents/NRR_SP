#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(scriptsDirectory);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function usage() {
  process.stdout.write(`Usage:
  node scripts/submit-review-html.mjs \\
    --html <path> --asin <ASIN> --star <1|2|3> --source-url <amazon-url> \\
    [--page-number <n>] [--since-date <YYYY-MM-DD>] [--submission-id <id>] \\
    [--client-id <id>] [--brand-id <id>] [--brand-name <name>] [--notify] \\
    [--webhook-url <url>]
`);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      values.help = true;
      continue;
    }
    if (!argument.startsWith('--')) fail(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (key === 'notify') {
      values.notify = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function readRequiredSecret() {
  const tokenPath = join(skillRoot, 'secrets', 'workflow-token.txt');
  if (!existsSync(tokenPath)) fail('Workflow token is not provisioned. Ask a SellerPlex administrator.');
  const token = readFileSync(tokenPath, 'utf8').trim();
  if (token.length < 32 || /^REPLACE_/i.test(token)) {
    fail('Workflow token is empty, too short, or still contains a placeholder.');
  }
  return token;
}

function readWebhookUrl(override) {
  if (override) return override;
  const urlPath = join(skillRoot, 'config', 'workflow-url.txt');
  if (!existsSync(urlPath)) fail('Workflow URL configuration is missing.');
  return readFileSync(urlPath, 'utf8').trim();
}

const args = parseArguments(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

for (const required of ['html', 'asin', 'star', 'source-url']) {
  if (!args[required]) fail(`Missing required argument: --${required}`);
}

const htmlPath = resolve(args.html);
if (!existsSync(htmlPath) || !statSync(htmlPath).isFile()) fail(`HTML file not found: ${htmlPath}`);

const asin = String(args.asin).trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(asin)) fail('ASIN must contain exactly 10 letters or digits.');

const star = Number(args.star);
if (![1, 2, 3].includes(star)) fail('Star must be 1, 2, or 3.');

let sourceUrl;
try {
  sourceUrl = new URL(args['source-url']);
} catch {
  fail('Source URL must be a valid URL.');
}
if (sourceUrl.protocol !== 'https:' || !/^(?:www\.)?amazon\.com$/i.test(sourceUrl.hostname)) {
  fail('Source URL must be an HTTPS amazon.com URL.');
}
if (!sourceUrl.pathname.toUpperCase().includes(`/${asin}`)) {
  fail('Source URL does not contain the requested ASIN.');
}

const expectedFilter = { 1: 'one_star', 2: 'two_star', 3: 'three_star' }[star];
if (sourceUrl.searchParams.get('filterByStar') !== expectedFilter) {
  fail(`Source URL must contain filterByStar=${expectedFilter}.`);
}

const pageNumber = Number(args['page-number'] ?? 1);
if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000) {
  fail('Page number must be an integer between 1 and 10000.');
}

const sinceDate = String(args['since-date'] ?? '');
if (sinceDate && !/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
  fail('Since date must use YYYY-MM-DD.');
}

const submissionId = String(args['submission-id'] ?? `team-${Date.now()}-${randomUUID().slice(0, 12)}`);
if (!/^[A-Za-z0-9._:-]{8,160}$/.test(submissionId)) {
  fail('Submission ID must be 8-160 characters using letters, digits, dot, underscore, colon, or hyphen.');
}

const html = readFileSync(htmlPath);
if (html.length < 5000) fail('HTML is too small to be a rendered Amazon review page.');
if (html.length > 8_000_000) fail('HTML exceeds the workflow 8 MB limit.');

const token = readRequiredSecret();
let webhookUrl;
try {
  webhookUrl = new URL(readWebhookUrl(args['webhook-url']));
} catch {
  fail('Workflow URL configuration is not a valid URL.');
}
if (webhookUrl.protocol !== 'https:') fail('Workflow URL must use HTTPS.');

webhookUrl.searchParams.set('asin', asin);
webhookUrl.searchParams.set('star_filter', String(star));
webhookUrl.searchParams.set('source_url', sourceUrl.toString());
webhookUrl.searchParams.set('submission_id', submissionId);
webhookUrl.searchParams.set('page_number', String(pageNumber));
webhookUrl.searchParams.set('notify', args.notify ? 'true' : 'false');
if (sinceDate) webhookUrl.searchParams.set('since_date', sinceDate);
for (const [argument, parameter] of [
  ['client-id', 'client_id'],
  ['brand-id', 'brand_id'],
  ['brand-name', 'brand_name'],
]) {
  if (args[argument]) webhookUrl.searchParams.set(parameter, args[argument]);
}

let response;
try {
  response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/html; charset=utf-8',
    },
    body: html,
  });
} catch (error) {
  fail(`Workflow request failed: ${error.message}`);
}

const responseText = await response.text();
if (!response.ok) {
  if (response.status === 401) fail('Workflow authentication failed. Confirm the local workflow token.');
  fail(`Workflow returned HTTP ${response.status}: ${responseText.slice(0, 1000)}`);
}

try {
  process.stdout.write(`${JSON.stringify(JSON.parse(responseText), null, 2)}\n`);
} catch {
  process.stdout.write(`${responseText}\n`);
}

