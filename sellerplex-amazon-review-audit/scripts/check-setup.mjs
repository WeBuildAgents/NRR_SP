#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(scriptsDirectory);

function readTrimmed(relativePath) {
  const absolutePath = join(skillRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8').trim() : '';
}

const majorNodeVersion = Number(process.versions.node.split('.')[0]);
const webhookUrl = readTrimmed(join('config', 'workflow-url.txt'));
const auditDataUrl = readTrimmed(join('config', 'audit-data-url.txt'));
const token = readTrimmed(join('secrets', 'workflow-token.txt'));

const checks = {
  node18OrNewer: Number.isInteger(majorNodeVersion) && majorNodeVersion >= 18,
  skillManifestPresent: existsSync(join(skillRoot, 'SKILL.md')),
  workflowContractPresent: existsSync(join(skillRoot, 'references', 'workflow-contract.md')),
  submitClientPresent: existsSync(join(skillRoot, 'scripts', 'submit-review-html.mjs')),
  historyClientPresent: existsSync(join(skillRoot, 'scripts', 'query-review-history.mjs')),
  coverageClientPresent: existsSync(join(skillRoot, 'scripts', 'record-review-coverage.mjs')),
  reportInputBuilderPresent: existsSync(join(skillRoot, 'scripts', 'build-report-input.mjs')),
  reportGeneratorPresent: existsSync(join(skillRoot, 'scripts', 'generate-report.mjs')),
  endToEndContractPresent: existsSync(join(skillRoot, 'references', 'end-to-end-flow.md')),
  reportSchemaPresent: existsSync(join(skillRoot, 'references', 'report-input-schema.md')),
  webhookConfigured: /^https:\/\//i.test(webhookUrl),
  auditDataEndpointConfigured: /^https:\/\//i.test(auditDataUrl),
  tokenProvisioned: token.length >= 32 && !/^REPLACE_/i.test(token),
};

const ok = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify({
  ok,
  skill: 'sellerplex-amazon-review-audit',
  runtime: `node-${process.versions.node}`,
  checks,
}, null, 2)}\n`);

process.exitCode = ok ? 0 : 1;

