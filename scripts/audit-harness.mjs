import { execFileSync } from 'node:child_process';

const checks = [
  ['node', ['scripts/check-doc-headers.mjs']],
  ['node', ['scripts/validate-ledger.mjs']],
  ['node', ['scripts/validate-handoffs.mjs']],
  ['node', ['scripts/check-completion-gates.mjs']],
  ['node', ['scripts/check-quality-scores.mjs']],
];

for (const [command, args] of checks) {
  const label = [command, ...args].join(' ');
  console.log(`\n> ${label}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

console.log('\n[PASS] Harness audit completed');
