import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const checks = [
  ['node', ['scripts/check-doc-headers.mjs']],
  ['node', ['scripts/validate-ledger.mjs']],
  ['node', ['scripts/validate-handoffs.mjs']],
  ['node', ['scripts/check-generator-output-parsing.mjs']],
  ['node', ['scripts/check-completion-gates.mjs']],
  ['node', ['scripts/check-final-git-state.mjs']],
  ['node', ['scripts/check-quality-scores.mjs']],
];

function requireText(filePath, text) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${filePath} must include ${text}`);
  }
}

requireText('package.json', '"run:validator-b": "node scripts/run-validator-b.mjs"');
requireText('scripts/run-validator-b.mjs', "run-validator-b only accepts Validator-B handoff");
requireText('scripts/run-validator-b.mjs', "Validator-B handoff must not include Validator-A or Codex references");
requireText('scripts/run-validator-b.mjs', "assertNoSecretLikeContent(prompt, 'Validator-B prompt')");
requireText('scripts/run-validator-b.mjs', "promptFileInstruction");
requireText('scripts/run-validator-b.mjs', "fs.writeFileSync(promptPath, prompt, 'utf8')");
requireText('scripts/run-validator-b.mjs', "--sandbox must be read-only for Validator-B");
requireText('scripts/run-validator-b.mjs', "'--approval-mode'");
requireText('scripts/run-validator-b.mjs', "'plan'");
requireText('scripts/run-validator-a.mjs', "'github_commit'");
requireText('scripts/run-validator-a.mjs', "'tier_reclassification_reason'");

for (const [command, args] of checks) {
  const label = [command, ...args].join(' ');
  console.log(`\n> ${label}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

console.log('\n[PASS] Harness audit completed');
