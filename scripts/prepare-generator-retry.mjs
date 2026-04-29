import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function usage() {
  console.error(`Usage:
  node scripts/prepare-generator-retry.mjs TASK-YYYYMMDD-NNN [options]

Options:
  --validator-result <path>      Validator result JSON. Defaults to latest validator-a-result*.json
  --generator-input <path>       Base Generator input JSON. Defaults to tasks/handoffs/<task>/generator-input.json
  --generator-result <path>      Generator result JSON. Defaults to tasks/handoffs/<task>/generator-result.json
  --attempt <n>                  Retry attempt number. Defaults to inferred next attempt
  --dry-run                      Validate and print planned output without writing files
`);
}

function parseArgs(argv) {
  const args = {
    validatorResult: null,
    generatorInput: null,
    generatorResult: null,
    attempt: null,
    dryRun: false,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--validator-result') {
      args.validatorResult = argv[++index];
    } else if (arg === '--generator-input') {
      args.generatorInput = argv[++index];
    } else if (arg === '--generator-result') {
      args.generatorResult = argv[++index];
    } else if (arg === '--attempt') {
      args.attempt = Number.parseInt(argv[++index], 10);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) throw new Error('Exactly one task_id is required.');
  args.taskId = positional[0];
  return args;
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function resolveInsideRoot(inputPath) {
  const absolute = path.resolve(root, inputPath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository root: ${inputPath}`);
  }
  return absolute;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${relativePath(filePath)} (${error.message})`);
  }
}

function handoffDir(taskId) {
  return path.join(root, 'tasks', 'handoffs', taskId);
}

function latestMatching(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return entries[0] ?? null;
}

function defaultValidatorResultPath(taskId) {
  const result = latestMatching(handoffDir(taskId), /^validator-a-result(?:-\d+)?\.json$/);
  if (!result) return path.join(handoffDir(taskId), 'validator-a-result-1.json');
  return result;
}

function inferAttempt(taskId, explicitAttempt) {
  if (explicitAttempt) return explicitAttempt;
  const dir = handoffDir(taskId);
  if (!fs.existsSync(dir)) return 2;
  const attempts = fs.readdirSync(dir)
    .map((name) => /^generator-input-retry-(\d+)\.json$/.exec(name)?.[1])
    .filter(Boolean)
    .map((item) => Number.parseInt(item, 10));
  return attempts.length === 0 ? 2 : Math.max(...attempts) + 1;
}

function validateValidatorResult(result, taskId) {
  if (result.task_id !== taskId) throw new Error(`Validator result task_id ${result.task_id} does not match ${taskId}`);
  if (result.agent !== 'Validator-A') throw new Error(`Validator result agent must be Validator-A, got ${result.agent}`);
  if (result.verdict !== 'FAIL') throw new Error(`prepare-generator-retry requires Validator FAIL result, got ${result.verdict}`);
  if (!Array.isArray(result.errors) || result.errors.length === 0) throw new Error('Validator FAIL result must contain errors[].');
  for (const [index, error] of result.errors.entries()) {
    for (const key of ['severity', 'evidence_type', 'location', 'description', 'suggestion', 'evidence']) {
      if (!error?.[key]) throw new Error(`Validator error ${index} is missing ${key}`);
    }
  }
}

function errorFingerprint(error) {
  return [
    error.evidence_type,
    error.location,
    normalize(error.description),
  ].join('|');
}

function normalize(text) {
  return String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function previousRetryFiles(taskId) {
  const dir = handoffDir(taskId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^generator-input-retry-\d+\.json$/.test(name))
    .map((name) => path.join(dir, name))
    .sort();
}

function previousFingerprints(taskId) {
  const fingerprints = new Set();
  for (const filePath of previousRetryFiles(taskId)) {
    try {
      const retry = readJson(filePath, 'Previous retry handoff');
      for (const attempt of retry.retry?.previous_attempts ?? []) {
        for (const error of attempt.validator_feedback ?? []) {
          fingerprints.add(errorFingerprint(error));
        }
      }
    } catch {
      // Ignore malformed historical retry files; current validation still runs on the present result.
    }
  }
  return fingerprints;
}

function sameErrorRepeatCount(taskId, validatorResult) {
  const previous = previousFingerprints(taskId);
  const current = validatorResult.errors.map(errorFingerprint);
  return current.some((fingerprint) => previous.has(fingerprint)) ? 2 : 1;
}

function retryInstruction(errors, repeatCount) {
  const core = errors.map((error, index) =>
    `${index + 1}. ${error.evidence_type} at ${error.location}: ${error.description} Suggestion: ${error.suggestion}`
  ).join('\n');
  const prefix = repeatCount >= 2
    ? 'Repeated Validator-A failures were detected. Do not retry automatically; use the Conflict Report.'
    : 'Address the Validator-A FAIL items below with a changed approach. Do not repeat the previous implementation strategy.';
  return `${prefix}\n${core}`;
}

function conflictReport(taskId, validatorResult, repeatCount) {
  const recurring = validatorResult.errors.map((error) =>
    `${error.evidence_type} ${error.location}: ${error.description}`
  ).join('; ');
  return {
    task_id: taskId,
    agent: 'Validator-A',
    type: 'CONFLICT_REPORT',
    loop_count: repeatCount,
    recurring_error: recurring,
    root_cause_hypothesis: 'Validator-A reported the same failure fingerprint across retry attempts; this may indicate a repeated implementation approach, ambiguous success criterion, or structural mismatch.',
    blocking_criterion: validatorResult.criteria_results?.find((item) => item.result === 'FAIL')?.criterion ?? 'Unknown success criterion',
    escalation_options: [
      'Run Analyst adjudication against Validator evidence and Task Spec.',
      'Refine success criteria if the criterion is ambiguous or structurally impossible.',
      'Re-enter Generator only after Analyst defines a materially different approach.',
    ],
  };
}

function appendLedger(ledgerPath, event) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8');
}

function nextEventId(ledgerPath, taskId) {
  if (!fs.existsSync(ledgerPath)) return `${taskId}-0001`;
  const count = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean).length;
  return `${taskId}-${String(count + 1).padStart(4, '0')}`;
}

function timestamp() {
  return new Date().toISOString();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^TASK-\d{8}-\d{3}$/.test(args.taskId)) throw new Error(`Invalid task_id: ${args.taskId}`);

  const dir = handoffDir(args.taskId);
  const generatorInputPath = resolveInsideRoot(args.generatorInput ?? path.join(dir, 'generator-input.json'));
  const generatorResultPath = resolveInsideRoot(args.generatorResult ?? path.join(dir, 'generator-result.json'));
  const validatorResultPath = resolveInsideRoot(args.validatorResult ?? defaultValidatorResultPath(args.taskId));

  if (!fs.existsSync(generatorInputPath)) throw new Error(`Generator input not found: ${relativePath(generatorInputPath)}`);
  if (!fs.existsSync(generatorResultPath)) throw new Error(`Generator result not found: ${relativePath(generatorResultPath)}`);
  if (!fs.existsSync(validatorResultPath)) throw new Error(`Validator result not found: ${relativePath(validatorResultPath)}`);

  const baseInput = readJson(generatorInputPath, 'Generator input');
  const generatorResult = readJson(generatorResultPath, 'Generator result');
  const validatorResult = readJson(validatorResultPath, 'Validator result');
  validateValidatorResult(validatorResult, args.taskId);

  const attempt = inferAttempt(args.taskId, args.attempt);
  if (!Number.isInteger(attempt) || attempt < 2) throw new Error('Retry attempt must be >= 2.');

  const repeatCount = sameErrorRepeatCount(args.taskId, validatorResult);
  const ledgerPath = resolveInsideRoot(baseInput.refs?.ledger ?? `logs/tasks/${args.taskId}.jsonl`);

  if (repeatCount >= 2) {
    const outputPath = path.join(dir, `conflict-report-${attempt}.json`);
    const report = conflictReport(args.taskId, validatorResult, repeatCount);
    console.log(`[retry] repeated failure detected; conflict report: ${relativePath(outputPath)}`);
    if (!args.dryRun) {
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      appendLedger(ledgerPath, {
        schema_version: 'work-history.v1',
        event_id: nextEventId(ledgerPath, args.taskId),
        task_id: args.taskId,
        task_tier: validatorResult.tier,
        agent: 'Analyst',
        timestamp: timestamp(),
        phase: 'ADJUDICATION',
        event_type: 'AUDIT_NOTE',
        status: 'HOLD',
        summary: 'Generated Conflict Report instead of retry handoff due to repeated Validator-A failure',
        details: {
          conflict_report_path: relativePath(outputPath),
          repeat_count: repeatCount,
          validator_result_path: relativePath(validatorResultPath),
        },
        artifact_refs: [{ type: 'conflict_report', path: relativePath(outputPath) }],
        redaction: { applied: false, notes: 'No sensitive data included.' },
        next_action: 'Analyst adjudication required before another Generator retry.',
      });
    }
    return;
  }

  const outputPath = path.join(dir, `generator-input-retry-${attempt}.json`);
  const retryInput = {
    ...baseInput,
    expected_output_path: `tasks/handoffs/${args.taskId}/generator-result-${attempt}.json`,
    retry: {
      attempt_no: attempt,
      previous_attempts: [
        {
          attempt_no: attempt - 1,
          generator_result_path: relativePath(generatorResultPath),
          validator_result_path: relativePath(validatorResultPath),
          generator_result_summary: generatorResult.change_summary ?? '',
          validator_feedback: validatorResult.errors,
        },
      ],
      retry_instruction: retryInstruction(validatorResult.errors, repeatCount),
      same_error_repeat_count: repeatCount,
    },
  };

  console.log(`[retry] output: ${relativePath(outputPath)}`);
  if (!args.dryRun) {
    fs.writeFileSync(outputPath, `${JSON.stringify(retryInput, null, 2)}\n`, 'utf8');
    appendLedger(ledgerPath, {
      schema_version: 'work-history.v1',
      event_id: nextEventId(ledgerPath, args.taskId),
      task_id: args.taskId,
      task_tier: validatorResult.tier,
      agent: 'Analyst',
      timestamp: timestamp(),
      phase: 'GENERATOR_HANDOFF',
      event_type: 'INSTRUCTION_SENT',
      status: 'RETRYING',
      summary: `Prepared Generator retry handoff attempt ${attempt} from Validator-A FAIL`,
      details: {
        retry_input_path: relativePath(outputPath),
        validator_result_path: relativePath(validatorResultPath),
        generator_result_path: relativePath(generatorResultPath),
        same_error_repeat_count: repeatCount,
      },
      artifact_refs: [{ type: 'generator_retry_input', path: relativePath(outputPath) }],
      redaction: { applied: false, notes: 'Validator evidence copied from local result; review before external sharing.' },
      next_action: `Run Generator retry with --input ${relativePath(outputPath)}.`,
    });
  }
}

try {
  main();
} catch (error) {
  console.error(`[retry] ${error.message}`);
  process.exit(1);
}
