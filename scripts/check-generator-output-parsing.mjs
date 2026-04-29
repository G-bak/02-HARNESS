import {
  synthesizeGeneratorResult,
  unwrapClaudeJsonOutput,
  validateGeneratorResult,
} from './run-generator.mjs';

let errors = 0;

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
}

function assert(condition, message) {
  if (!condition) reportError(message);
}

const structured = {
  task_id: 'TASK-20260429-010',
  agent: 'Generator',
  status: 'PENDING_VALIDATION',
  artifacts: [],
  change_summary: 'Structured output fixture.',
  self_review: 'Fixture self review.',
  tier_reclassification_needed: false,
  log: [],
};

const wrappedStructured = unwrapClaudeJsonOutput(JSON.stringify({
  type: 'result',
  result: 'Natural-language summary that should not be parsed when structured_output exists.',
  structured_output: structured,
}));

assert(wrappedStructured.kind === 'structured_output', 'structured_output must be preferred over natural-language result text');
try {
  validateGeneratorResult(wrappedStructured.generatorResult, 'TASK-20260429-010');
} catch (error) {
  reportError(`structured_output fixture failed validation (${error.message})`);
}

const wrappedNatural = unwrapClaudeJsonOutput(JSON.stringify({
  type: 'result',
  result: 'Updated docs/guides/example.md with the requested note.',
}));

assert(wrappedNatural.kind === 'natural_language', 'plain result text must be classified as natural_language');

const synthetic = synthesizeGeneratorResult(
  'TASK-20260429-010',
  wrappedNatural.naturalLanguageReport,
  {
    changed_files: ['docs/guides/example.md'],
    target_files: ['docs/guides/example.md'],
    out_of_scope_files: [],
  },
  {
    stat: 'docs/guides/example.md | 1 +',
    numstat: '1\t0\tdocs/guides/example.md',
  },
);

assert(synthetic.status === 'PENDING_VALIDATION', 'natural-language result with target diff must synthesize PENDING_VALIDATION');
assert(synthetic.artifacts.length === 1, 'synthetic natural-language result must record changed target artifact');
assert(synthetic.recovery?.type === 'synthetic_from_natural_language_report', 'synthetic result must record recovery provenance');

const noDiffSynthetic = synthesizeGeneratorResult(
  'TASK-20260429-010',
  wrappedNatural.naturalLanguageReport,
  {
    changed_files: [],
    target_files: ['docs/guides/example.md'],
    out_of_scope_files: [],
  },
  {
    stat: '',
    numstat: '',
  },
);

assert(noDiffSynthetic.status === 'HOLD', 'natural-language result without target diff must synthesize HOLD');

if (errors > 0) {
  console.error(`[FAIL] Generator output parsing check failed with ${errors} error(s)`);
  process.exit(1);
}

console.log('[PASS] Generator output parsing fixtures accepted');
