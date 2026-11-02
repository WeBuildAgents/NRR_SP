#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const inputArg = process.argv[2];
if (!inputArg) {
  process.stderr.write('Usage: node scripts/record-review-coverage.mjs <coverage.json>\n');
  process.exit(1);
}

function readRequired(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing.`);
  const value = readFileSync(path, 'utf8').trim();
  if (!value || /^REPLACE_/i.test(value)) throw new Error(`${label} is not provisioned.`);
  return value;
}

try {
  const input = JSON.parse(readFileSync(resolve(inputArg), 'utf8'));
  const token = readRequired(join(skillRoot, 'secrets', 'workflow-token.txt'), 'Workflow token');
  const endpoint = readRequired(join(skillRoot, 'config', 'audit-data-url.txt'), 'Audit-data endpoint');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, action: 'record_coverage' }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(response.status === 401 ? 'Workflow authentication failed.' : `Coverage recording returned HTTP ${response.status}: ${text.slice(0, 1000)}`);
  process.stdout.write(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

