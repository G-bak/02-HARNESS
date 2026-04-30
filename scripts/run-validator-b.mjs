import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertNoSecretLikeContent } from './lib/secret-scan.mjs';
import { appendLedger, nextEventId } from './lib/ledger-events.mjs';

const root = process.cwd();
const forbiddenFlags = new Set([
  '--yolo',
  '--approval-mode=yolo',
  'yolo',
  '--all-files',
]);
const maxEmbeddedFileBytes = 256 * 1024;
const maxEmbeddedContextBytes = 1024 * 1024;
const promptFileInstruction = 'Use read-only file access to read the Validator-B payload at';

function usage() {
  console.error(`Usage:
  node scripts/run-validator-b.mjs TASK-YYYYMMDD-NNN [options]

Options:
  --input <path>             Validator handoff path. Defaults to tasks/handoffs/<task>/validator-b-input.json
  --dry-run                  Validate paths and print the Gemini command without executing it
  --gemini-bin <command>     Gemini CLI binary. Defaults to VALIDATOR_GEMINI_BIN or gemini
  --model <model>            Gemini model. Defaults to VALIDATOR_GEMINI_MODEL or current config
  --sandbox <mode>           Must be read-only for Validator-B. Defaults to read-only
  --attempt <n>              Attempt number. Defaults to 1
`);
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    geminiBin: process.env.VALIDATOR_GEMINI_BIN || 'gemini',
    model: process.env.VALIDATOR_GEMINI_MODEL || null,
    sandbox: process.env.VALIDATOR_GEMINI_SANDBOX || 'read-only',
    input: null,
    attempt: 1,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--input') {
      args.input = argv[++index];
    } else if (arg === '--gemini-bin') {
      args.geminiBin = argv[++index];
    } else if (arg === '--model') {
      args.model = argv[++index];
    } else if (arg === '--sandbox') {
      args.sandbox = argv[++index];
    } else if (arg === '--attempt') {
      args.attempt = Number.parseInt(argv[++index], 10);
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
  if (!Number.isInteger(args.attempt) || args.attempt < 1) {
    throw new Error('--attempt must be a positive integer.');
  }
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

function resolveInsideDirectory(inputPath, directoryPath, label) {
  const absolute = resolveInsideRoot(inputPath);
  const relative = path.relative(directoryPath, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${relativePath(directoryPath)}: ${inputPath}`);
  }
  return absolute;
}

function defaultInputPath(taskId) {
  return path.join(root, 'tasks', 'handoffs', taskId, 'validator-b-input.json');
}

function parseHandoff(inputPath, taskId) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  assertNoSecretLikeContent(raw, relativePath(inputPath));
  const data = JSON.parse(raw);
  const required = [
    'schema_version',
    'task_id',
    'agent',
    'invocation',
    'refs',
    'changed_files',
    'success_criteria',
    'known_risks',
    'forbidden_context',
    'expected_output_path',
    'expected_output_schema',
  ];

  for (const key of required) {
    if (!(key in data)) throw new Error(`Validator handoff is missing required field: ${key}`);
  }

  if (data.schema_version !== 'validator-handoff.v1') {
    throw new Error(`Unsupported validator handoff schema_version: ${data.schema_version}`);
  }
  if (data.task_id !== taskId) throw new Error(`Handoff task_id ${data.task_id} does not match ${taskId}`);
  if (data.agent !== 'Validator-B') throw new Error(`run-validator-b only accepts Validator-B handoff, got ${data.agent}`);
  if (data.invocation?.runtime !== 'Gemini CLI') throw new Error('Validator-B handoff invocation.runtime must be Gemini CLI.');
  if (data.invocation?.fresh_session_required !== true) throw new Error('Validator-B handoff must require fresh session.');
  if (data.invocation?.sandbox !== 'read-only') throw new Error('Validator-B handoff invocation.sandbox must be read-only.');

  assertValidatorBIndependence(data);

  const handoffDir = path.join(root, 'tasks', 'handoffs', taskId);
  const specPath = resolveInsideRoot(data.refs.spec);
  const ledgerPath = resolveInsideRoot(data.refs.ledger);
  const generatorResultPath = resolveInsideRoot(data.refs.generator_result);
  const outputPath = resolveInsideDirectory(data.expected_output_path, handoffDir, 'expected_output_path');

  if (!fs.existsSync(specPath)) throw new Error(`Referenced Task Spec does not exist: ${data.refs.spec}`);
  if (!fs.existsSync(generatorResultPath)) throw new Error(`Referenced Generator result does not exist: ${data.refs.generator_result}`);
  if (!ledgerPath.endsWith(`${taskId}.jsonl`)) throw new Error(`refs.ledger must point to logs/tasks/${taskId}.jsonl`);
  if (!path.basename(outputPath).startsWith('validator-b-result') || path.extname(outputPath) !== '.json') {
    throw new Error('expected_output_path must be validator-b-result*.json inside the task handoff directory.');
  }

  return {
    raw,
    data,
    specPath,
    ledgerPath,
    generatorResultPath,
    outputPath,
  };
}

function assertValidatorBIndependence(data) {
  const guardedValues = [
    ...Object.values(data.refs ?? {}),
    ...(data.changed_files ?? []),
    ...(data.previous_failures ?? []).map((failure) => JSON.stringify(failure)),
  ].filter((value) => typeof value === 'string');

  const blocked = guardedValues.find((value) => /validator[-_]?a|codex/i.test(value));
  if (blocked) {
    throw new Error(`Validator-B handoff must not include Validator-A or Codex references: ${blocked}`);
  }
}

function assertNoValidatorArtifactReferences(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/validator[-_]?a|codex/i.test(text)) {
    throw new Error(`Validator-B prompt context must not include Validator-A or Codex references in ${label}`);
  }
}

function readContextFile(filePath, label, budget) {
  if (!fs.existsSync(filePath)) return { label, path: relativePath(filePath), status: 'missing', content: '' };
  const stat = fs.statSync(filePath);
  if (stat.size > maxEmbeddedFileBytes) {
    return {
      label,
      path: relativePath(filePath),
      status: 'omitted_too_large',
      content: `File omitted because it is ${stat.size} bytes; Validator-B may inspect it from the workspace if needed.`,
    };
  }
  if (budget.usedBytes + stat.size > budget.maxBytes) {
    return {
      label,
      path: relativePath(filePath),
      status: 'omitted_for_total_budget',
      content: `File omitted because embedding it would exceed the ${budget.maxBytes} byte Validator-B prompt context budget.`,
    };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  assertNoSecretLikeContent(content, relativePath(filePath));
  assertNoValidatorArtifactReferences(content, relativePath(filePath));
  budget.usedBytes += stat.size;
  return { label, path: relativePath(filePath), status: 'included', content };
}

function buildReviewContext(handoff) {
  const budget = { usedBytes: 0, maxBytes: maxEmbeddedContextBytes };
  const files = [
    readContextFile(handoff.specPath, 'task_spec', budget),
    readContextFile(handoff.generatorResultPath, 'generator_result', budget),
  ];

  for (const file of handoff.data.changed_files ?? []) {
    const absolute = resolveInsideRoot(file);
    files.push(readContextFile(absolute, 'changed_file', budget));
  }

  return {
    budget: {
      used_bytes: budget.usedBytes,
      max_bytes: budget.maxBytes,
    },
    files,
  };
}

function inferTaskTier(handoff) {
  const spec = JSON.parse(fs.readFileSync(handoff.specPath, 'utf8'));
  return spec.complexity_tier || spec.task_tier || spec.tier || 'Tier3';
}

function isValidatorBSmokeHandoff(handoff) {
  const text = JSON.stringify([
    handoff.data.success_criteria,
    handoff.data.known_risks,
    handoff.data.expected_output_path,
  ]);
  return /run-validator-b|validator-b.*smoke|smoke.*validator-b/i.test(text);
}

function assertValidatorBTierAllowed(handoff, taskTier) {
  if (taskTier === 'Tier3') return;
  if (isValidatorBSmokeHandoff(handoff)) return;
  throw new Error(`Validator-B is Tier3-only except explicit runner smoke tasks; got ${taskTier}.`);
}

function commandArgs(args, promptPath) {
  if (args.sandbox !== 'read-only') {
    throw new Error('--sandbox must be read-only for Validator-B.');
  }

  const cliArgs = [
    '--prompt',
    `${promptFileInstruction} ${relativePath(promptPath)}. Follow the instructions inside it. Do not echo the file. Return only the final validator-result JSON object.`,
    '--output-format',
    'json',
    '--approval-mode',
    'plan',
  ];

  if (args.model) cliArgs.push('--model', args.model);

  for (const item of cliArgs) {
    if (forbiddenFlags.has(item)) throw new Error(`Forbidden Gemini CLI flag configured: ${item}`);
  }

  return cliArgs;
}

function spawnCommand(command, args, options) {
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)) {
    const script = [
      '$ErrorActionPreference = "Stop"',
      '$geminiArgs = ConvertFrom-Json -InputObject $env:VALIDATOR_GEMINI_ARGS_JSON',
      '& $env:VALIDATOR_GEMINI_BIN @geminiArgs',
      'exit $LASTEXITCODE',
    ].join('; ');
    return {
      result: spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        ...options,
        env: {
          ...process.env,
          ...(options.env ?? {}),
          VALIDATOR_GEMINI_BIN: command,
          VALIDATOR_GEMINI_ARGS_JSON: JSON.stringify(args),
        },
      }),
      actualCommand: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '<gemini args passed via environment JSON>'],
    };
  }

  return {
    result: spawnSync(command, args, options),
    actualCommand: [command, ...args],
  };
}

function systemInstruction(handoff, reviewContext) {
  const schemaPath = path.join(root, 'docs', 'schemas', 'validator-result.schema.json');
  const validatorResultSchema = fs.readFileSync(schemaPath, 'utf8');
  return [
    'You are Validator-B for the 02-HARNESS system.',
    'You are an independent Tier 3 security and design reviewer using Gemini CLI.',
    'Evaluate only the Generator result, Task Spec, and changed-file context in this prompt.',
    'Do not use or infer from Validator-A inputs, Validator-A outputs, or any other validator result.',
    'Do not read validator-a-* artifacts, codex artifacts, validator-a-result*.json, validator-a-events*.jsonl, validator-a-run*.json, or any file path containing Validator-A or Codex.',
    'If such artifacts are visible in the workspace, ignore them and continue only with the prompt-provided context.',
    'Do not modify files. Do not merge. Do not browse the web. Do not reveal secrets or environment variable values.',
    'Return exactly one JSON object matching docs/schemas/validator-result.schema.json.',
    'Set agent to "Validator-B" and tool to "Gemini CLI".',
    'If you fail the task, every error must include severity, evidence_type, location, description, suggestion, and evidence.',
    'Do not wrap the JSON object in Markdown fences.',
    '',
    '<validator_result_schema_json>',
    validatorResultSchema,
    '</validator_result_schema_json>',
    '',
    '<validator_handoff_json>',
    handoff.raw,
    '</validator_handoff_json>',
    '',
    '<review_context_json>',
    JSON.stringify(reviewContext, null, 2),
    '</review_context_json>',
  ].join('\n');
}

function timestamp() {
  return new Date().toISOString();
}

function parseJsonText(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} must be valid JSON (${error.message})`);
  }
}

function extractCandidateText(parsed) {
  if (typeof parsed === 'string') return parsed;
  for (const key of ['result', 'response', 'text', 'content', 'output']) {
    if (typeof parsed?.[key] === 'string') return parsed[key];
  }
  if (Array.isArray(parsed?.candidates)) {
    const first = parsed.candidates[0];
    if (typeof first?.content === 'string') return first.content;
    if (typeof first?.text === 'string') return first.text;
  }
  return null;
}

function readGeminiResult(stdoutPath, taskId) {
  const text = fs.readFileSync(stdoutPath, 'utf8').trim();
  const parsed = parseJsonText(text, 'Gemini stdout');
  if (parsed?.task_id === taskId && parsed?.agent) return parsed;

  const candidate = extractCandidateText(parsed);
  if (!candidate) return parsed;

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return parseJsonText((fenced ? fenced[1] : candidate).trim(), 'Gemini response JSON');
}

function validateValidatorResult(result, taskId) {
  const required = [
    'task_id',
    'agent',
    'tool',
    'tier',
    'verdict',
    'criteria_results',
    'errors',
    'github_commit',
    'tier_reclassification_needed',
    'tier_reclassification_reason',
    'log',
  ];
  for (const key of required) {
    if (!(key in result)) throw new Error(`Validator result is missing required field: ${key}`);
  }
  if (result.task_id !== taskId) throw new Error(`Validator result task_id ${result.task_id} does not match ${taskId}`);
  if (result.agent !== 'Validator-B') throw new Error(`Validator result agent must be Validator-B, got ${result.agent}`);
  if (result.tool !== 'Gemini CLI') throw new Error(`Validator result tool must be Gemini CLI, got ${result.tool}`);
  if (result.verdict !== 'PASS' && result.verdict !== 'FAIL') throw new Error(`Validator verdict must be PASS or FAIL, got ${result.verdict}`);
  if (!Array.isArray(result.criteria_results)) throw new Error('Validator criteria_results must be an array.');
  if (!Array.isArray(result.errors)) throw new Error('Validator errors must be an array.');
  if (!Array.isArray(result.log)) throw new Error('Validator log must be an array.');
  if (result.criteria_results.length === 0) throw new Error('Validator criteria_results must include at least one item.');
  if (result.verdict === 'FAIL' && result.errors.length === 0) {
    throw new Error('Validator FAIL requires at least one errors[] item.');
  }
  for (const [index, error] of result.errors.entries()) {
    for (const key of ['severity', 'evidence_type', 'location', 'description', 'suggestion', 'evidence']) {
      if (!error?.[key]) throw new Error(`Validator error ${index} is missing required field: ${key}`);
    }
  }
  return result;
}

function classifyResourceFailure(result) {
  const stderr = result.stderr || '';
  const combined = `${result.error?.message || ''}\n${stderr}`.toLowerCase();
  if (combined.includes('rate limit') || combined.includes('429')) return 'RATE_LIMIT';
  if (combined.includes('quota')) return 'QUOTA_EXHAUSTED';
  if (combined.includes('context') || combined.includes('token')) return 'CONTEXT_LIMIT';
  if (combined.includes('auth') || combined.includes('billing') || combined.includes('api key')) return 'AUTH_OR_BILLING';
  return 'TOOL_UNAVAILABLE';
}

function appendResourceFailure({
  handoff,
  args,
  taskTier,
  finishedAt,
  result,
  metadataPath,
  stdoutPath,
  stderrPath,
  summary,
  resourceErrorType,
  message,
}) {
  appendLedger(handoff.ledgerPath, {
    schema_version: 'work-history.v1',
    event_id: nextEventId(handoff.ledgerPath, args.taskId),
    task_id: args.taskId,
    task_tier: taskTier,
    agent: 'Analyst',
    timestamp: finishedAt,
    phase: 'VALIDATION',
    event_type: 'RESOURCE_FAILURE',
    status: 'HOLD',
    summary,
    details: {
      resource_error_type: resourceErrorType ?? classifyResourceFailure(result ?? {}),
      exit_status: result?.status ?? null,
      signal: result?.signal ?? null,
      message: message ?? result?.error?.message ?? null,
      metadata_path: relativePath(metadataPath),
    },
    artifact_refs: [
      { type: 'validator_stdout', path: relativePath(stdoutPath) },
      { type: 'validator_stderr', path: relativePath(stderrPath) },
      { type: 'validator_run_metadata', path: relativePath(metadataPath) },
    ],
    redaction: { applied: false, notes: 'Stdout/stderr artifacts must be reviewed before external sharing.' },
    next_action: 'Resolve Validator-B resource failure and rerun validation before Tier 3 merge.',
  });
}

function safeCommandForLog(command, args) {
  return [command, ...args.map((arg) => (String(arg).length > 200 ? '<prompt omitted>' : arg))];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^TASK-\d{8}-\d{3}$/.test(args.taskId)) throw new Error(`Invalid task_id: ${args.taskId}`);

  const inputPath = args.input ? resolveInsideRoot(args.input) : defaultInputPath(args.taskId);
  if (!fs.existsSync(inputPath)) throw new Error(`Validator input not found: ${relativePath(inputPath)}`);

  const handoff = parseHandoff(inputPath, args.taskId);
  const reviewContext = buildReviewContext(handoff);
  const prompt = systemInstruction(handoff, reviewContext);
  assertNoSecretLikeContent(prompt, 'Validator-B prompt');

  const outputDir = path.dirname(handoff.outputPath);
  const stdoutPath = path.join(outputDir, `validator-b-stdout-${args.attempt}.json`);
  const stderrPath = path.join(outputDir, `validator-b-stderr-${args.attempt}.log`);
  const metadataPath = path.join(outputDir, `validator-b-run-${args.attempt}.json`);
  const promptPath = path.join(outputDir, `validator-b-prompt-${args.attempt}.txt`);
  const cliArgs = commandArgs(args, promptPath);
  const safeCommand = safeCommandForLog(args.geminiBin, cliArgs);
  const taskTier = inferTaskTier(handoff);
  assertValidatorBTierAllowed(handoff, taskTier);

  console.log(`[validator-b] task: ${args.taskId}`);
  console.log(`[validator-b] input: ${relativePath(inputPath)}`);
  console.log(`[validator-b] output: ${relativePath(handoff.outputPath)}`);
  console.log(`[validator-b] command: ${safeCommand.join(' ')}`);

  if (args.dryRun) {
    console.log('[validator-b] dry run only; ledger and output files were not changed');
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(promptPath, prompt, 'utf8');
  appendLedger(handoff.ledgerPath, {
    schema_version: 'work-history.v1',
    event_id: nextEventId(handoff.ledgerPath, args.taskId),
    task_id: args.taskId,
    task_tier: taskTier,
    agent: 'Analyst',
    timestamp: timestamp(),
    phase: 'VALIDATION',
    event_type: 'INSTRUCTION_SENT',
    status: 'PENDING_VALIDATION',
    summary: 'Invoked Validator-B through scripts/run-validator-b.mjs',
    details: {
      input_path: relativePath(inputPath),
      expected_output_path: relativePath(handoff.outputPath),
      command_shape: safeCommand,
      sandbox: args.sandbox,
      approval_mode: 'plan',
      model: args.model,
      attempt: args.attempt,
    },
    artifact_refs: [{ type: 'validator_handoff_input', path: relativePath(inputPath) }],
    redaction: { applied: false, notes: 'No secret values recorded; prompt artifact must be reviewed before external sharing.' },
    next_action: 'Wait for Validator-B result.',
  });

  const startedAt = timestamp();
  const spawned = spawnCommand(args.geminiBin, cliArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const { result } = spawned;
  const finishedAt = timestamp();

  fs.writeFileSync(stdoutPath, result.stdout ?? '', 'utf8');
  fs.writeFileSync(stderrPath, result.stderr ?? '', 'utf8');
  fs.writeFileSync(metadataPath, `${JSON.stringify({
    task_id: args.taskId,
    started_at: startedAt,
    finished_at: finishedAt,
    exit_status: result.status,
    signal: result.signal,
    input_path: relativePath(inputPath),
    output_path: relativePath(handoff.outputPath),
    stdout_path: relativePath(stdoutPath),
    stderr_path: relativePath(stderrPath),
    prompt_path: relativePath(promptPath),
    command_shape: safeCommand,
    actual_spawn_command: safeCommandForLog(spawned.actualCommand[0], spawned.actualCommand.slice(1)),
    sandbox: args.sandbox,
    approval_mode: 'plan',
    model: args.model,
    attempt: args.attempt,
  }, null, 2)}\n`, 'utf8');

  if (result.error || result.status !== 0 || !fs.existsSync(stdoutPath) || fs.statSync(stdoutPath).size === 0) {
    appendResourceFailure({
      handoff,
      args,
      taskTier,
      finishedAt,
      result,
      metadataPath,
      stdoutPath,
      stderrPath,
      summary: 'Validator-B CLI invocation failed before a valid result was captured',
    });
    process.exit(result.status || 1);
  }

  let parsed;
  try {
    parsed = validateValidatorResult(readGeminiResult(stdoutPath, args.taskId), args.taskId);
  } catch (error) {
    appendResourceFailure({
      handoff,
      args,
      taskTier,
      finishedAt,
      result,
      metadataPath,
      stdoutPath,
      stderrPath,
      summary: 'Validator-B CLI returned malformed or schema-invalid output',
      resourceErrorType: 'MALFORMED_OUTPUT',
      message: error.message,
    });
    process.exit(1);
  }
  fs.writeFileSync(handoff.outputPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  appendLedger(handoff.ledgerPath, {
    schema_version: 'work-history.v1',
    event_id: nextEventId(handoff.ledgerPath, args.taskId),
    task_id: args.taskId,
    task_tier: taskTier,
    agent: 'Validator-B',
    timestamp: finishedAt,
    phase: 'VALIDATION',
    event_type: 'VALIDATION_RESULT',
    status: parsed.verdict === 'PASS' ? 'COMPLETE' : 'RETRYING',
    summary: `Validator-B ${parsed.verdict}`,
    details: parsed,
    artifact_refs: [
      { type: 'validator_result', path: relativePath(handoff.outputPath) },
      { type: 'validator_stdout', path: relativePath(stdoutPath) },
      { type: 'validator_run_metadata', path: relativePath(metadataPath) },
      { type: 'validator_stderr', path: relativePath(stderrPath) },
    ],
    redaction: { applied: false, notes: 'Validator artifacts stored locally; review before external sharing.' },
    next_action: parsed.verdict === 'PASS'
      ? 'For Tier 3, combine with Validator-A PASS and Analyst approval before merge.'
      : 'Prepare Generator retry handoff or Conflict Report according to failure-handling policy.',
  });
}

try {
  main();
} catch (error) {
  console.error(`[validator-b] ${error.message}`);
  process.exit(1);
}
