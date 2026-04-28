import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const forbiddenFlags = new Set([
  '--continue',
  '--resume',
  '--from-pr',
  '--fork-session',
  '--dangerously-skip-permissions',
  '--allow-dangerously-skip-permissions',
]);

function usage() {
  console.error(`Usage:
  node scripts/run-generator.mjs TASK-YYYYMMDD-NNN [options]

Options:
  --input <path>             Handoff input path. Defaults to tasks/handoffs/<task>/generator-input.json or .md
  --dry-run                  Validate paths and print the Claude command without executing it
  --claude-bin <command>     Claude CLI binary name. Defaults to GENERATOR_CLAUDE_BIN or claude
  --model <model>            Claude model alias or id. Defaults to GENERATOR_CLAUDE_MODEL or best
  --effort <level>           Reasoning effort. Defaults to GENERATOR_CLAUDE_EFFORT or xhigh
  --permission-mode <mode>   Claude permission mode. Defaults to GENERATOR_PERMISSION_MODE or auto
  --allowed-tools <value>    Override --allowedTools value
  --disallowed-tools <value> Override --disallowedTools value
  --fallback-model <model>   Optional Claude fallback model
  --allow-bypass-permissions Allow permission-mode bypassPermissions for isolated test environments only
`);
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    claudeBin: process.env.GENERATOR_CLAUDE_BIN || 'claude',
    model: process.env.GENERATOR_CLAUDE_MODEL || 'best',
    effort: process.env.GENERATOR_CLAUDE_EFFORT || 'xhigh',
    permissionMode: process.env.GENERATOR_PERMISSION_MODE || 'auto',
    fallbackModel: process.env.GENERATOR_CLAUDE_FALLBACK_MODEL || null,
    allowBypassPermissions: false,
    input: null,
    allowedTools: 'Read,Edit,Write,Bash(npm test),Bash(git diff *)',
    disallowedTools: 'WebSearch,WebFetch',
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--input') {
      args.input = argv[++index];
    } else if (arg === '--claude-bin') {
      args.claudeBin = argv[++index];
    } else if (arg === '--model') {
      args.model = argv[++index];
    } else if (arg === '--effort') {
      args.effort = argv[++index];
    } else if (arg === '--permission-mode') {
      args.permissionMode = argv[++index];
    } else if (arg === '--fallback-model') {
      args.fallbackModel = argv[++index];
    } else if (arg === '--allow-bypass-permissions') {
      args.allowBypassPermissions = true;
    } else if (arg === '--allowed-tools') {
      args.allowedTools = argv[++index];
    } else if (arg === '--disallowed-tools') {
      args.disallowedTools = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error('Exactly one task_id is required.');
  }

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

function defaultInputPath(taskId) {
  const base = path.join(root, 'tasks', 'handoffs', taskId);
  const json = path.join(base, 'generator-input.json');
  const markdown = path.join(base, 'generator-input.md');

  if (fs.existsSync(json)) return json;
  if (fs.existsSync(markdown)) return markdown;
  return json;
}

function parseHandoff(inputPath, taskId) {
  const raw = fs.readFileSync(inputPath, 'utf8');

  if (!inputPath.endsWith('.json')) {
    return {
      raw,
      data: null,
      outputPath: path.join(root, 'tasks', 'handoffs', taskId, 'generator-result.json'),
      ledgerPath: path.join(root, 'logs', 'tasks', `${taskId}.jsonl`),
    };
  }

  const data = JSON.parse(raw);
  const required = [
    'schema_version',
    'task_id',
    'agent',
    'invocation',
    'refs',
    'allowed_context',
    'forbidden_context',
    'expected_output_path',
    'expected_output_schema',
  ];

  for (const key of required) {
    if (!(key in data)) {
      throw new Error(`Generator handoff is missing required field: ${key}`);
    }
  }

  if (data.schema_version !== 'generator-handoff.v1') {
    throw new Error(`Unsupported generator handoff schema_version: ${data.schema_version}`);
  }

  if (data.task_id !== taskId) {
    throw new Error(`Handoff task_id ${data.task_id} does not match ${taskId}`);
  }

  if (data.agent !== 'Generator') {
    throw new Error(`Handoff agent must be Generator, got ${data.agent}`);
  }

  if (data.invocation?.fresh_session_required !== true || data.invocation?.forbid_resume_or_continue !== true) {
    throw new Error('Handoff invocation must require fresh session and forbid resume/continue.');
  }

  return {
    raw,
    data,
    outputPath: resolveInsideRoot(data.expected_output_path),
    ledgerPath: resolveInsideRoot(data.refs.ledger),
  };
}

function commandArgs(args) {
  if (args.permissionMode === 'bypassPermissions' && !args.allowBypassPermissions) {
    throw new Error('permission-mode bypassPermissions requires --allow-bypass-permissions and an isolated test environment.');
  }

  const cliArgs = [
    '--bare',
    '--print',
    '--model',
    args.model,
    '--effort',
    args.effort,
    '--input-format',
    'text',
    '--output-format',
    'json',
    '--no-session-persistence',
    '--permission-mode',
    args.permissionMode,
    '--allowedTools',
    args.allowedTools,
    '--disallowedTools',
    args.disallowedTools,
  ];

  if (args.fallbackModel) {
    cliArgs.push('--fallback-model', args.fallbackModel);
  }

  for (const item of cliArgs) {
    if (forbiddenFlags.has(item)) {
      throw new Error(`Forbidden Claude CLI flag configured: ${item}`);
    }
  }

  return cliArgs;
}

function promptFor(rawInput) {
  return [
    'You are the Generator for the 02-HARNESS system.',
    'Use only the handoff payload below and the repository files it explicitly allows.',
    'Do not use web search. Do not use --continue or --resume. Do not include secrets.',
    'Write the Generator result JSON to stdout using the expected output schema.',
    '',
    rawInput,
  ].join('\n');
}

function inferTaskTier(handoff, fallback = 'Tier2') {
  if (!handoff.data?.refs?.spec) return fallback;

  const specPath = resolveInsideRoot(handoff.data.refs.spec);
  if (!fs.existsSync(specPath)) return fallback;

  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    return spec.complexity_tier || spec.task_tier || fallback;
  } catch {
    return fallback;
  }
}

function appendLedger(ledgerPath, event) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8');
}

function timestamp() {
  return new Date().toISOString();
}

function nextEventId(ledgerPath, taskId) {
  if (!fs.existsSync(ledgerPath)) return `${taskId}-0001`;

  const count = fs.readFileSync(ledgerPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .length;

  return `${taskId}-${String(count + 1).padStart(4, '0')}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^TASK-\d{8}-\d{3}$/.test(args.taskId)) {
    throw new Error(`Invalid task_id: ${args.taskId}`);
  }

  const inputPath = args.input ? resolveInsideRoot(args.input) : defaultInputPath(args.taskId);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Generator input not found: ${relativePath(inputPath)}`);
  }

  const handoff = parseHandoff(inputPath, args.taskId);
  const outputDir = path.dirname(handoff.outputPath);
  const stderrPath = path.join(outputDir, 'generator-stderr.log');
  const metadataPath = path.join(outputDir, 'generator-run.json');
  const cliArgs = commandArgs(args);
  const safeCommand = [args.claudeBin, ...cliArgs];
  const taskTier = inferTaskTier(handoff);

  console.log(`[generator] task: ${args.taskId}`);
  console.log(`[generator] input: ${relativePath(inputPath)}`);
  console.log(`[generator] output: ${relativePath(handoff.outputPath)}`);
  console.log(`[generator] command: ${safeCommand.join(' ')}`);

  if (args.dryRun) {
    console.log('[generator] dry run only; ledger and output files were not changed');
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  appendLedger(handoff.ledgerPath, {
    schema_version: 'work-history.v1',
    event_id: nextEventId(handoff.ledgerPath, args.taskId),
    task_id: args.taskId,
    task_tier: taskTier,
    agent: 'Analyst',
    timestamp: timestamp(),
    phase: 'GENERATOR_HANDOFF',
    event_type: 'INSTRUCTION_SENT',
    status: 'ACTIVE',
    summary: 'Invoked Generator through scripts/run-generator.mjs',
    details: {
      input_path: relativePath(inputPath),
      expected_output_path: relativePath(handoff.outputPath),
      command_shape: safeCommand,
      model: args.model,
      effort: args.effort,
      permission_mode: args.permissionMode,
      fallback_model: args.fallbackModel,
      fresh_session_required: true,
      forbidden_flags_enforced: [...forbiddenFlags],
    },
    artifact_refs: [
      { type: 'handoff_input', path: relativePath(inputPath) },
    ],
    redaction: { applied: false, notes: 'No secret values recorded; command contains only flag names and tool allowlists.' },
    next_action: 'Wait for Claude CLI Generator result.',
  });

  const startedAt = timestamp();
  const result = spawnSync(args.claudeBin, cliArgs, {
    cwd: root,
    input: promptFor(handoff.raw),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const finishedAt = timestamp();

  fs.writeFileSync(handoff.outputPath, result.stdout ?? '', 'utf8');
  fs.writeFileSync(stderrPath, result.stderr ?? '', 'utf8');
  fs.writeFileSync(metadataPath, `${JSON.stringify({
    task_id: args.taskId,
    started_at: startedAt,
    finished_at: finishedAt,
    exit_status: result.status,
    signal: result.signal,
    input_path: relativePath(inputPath),
    output_path: relativePath(handoff.outputPath),
    stderr_path: relativePath(stderrPath),
    command_shape: safeCommand,
    model: args.model,
    effort: args.effort,
    permission_mode: args.permissionMode,
    fallback_model: args.fallbackModel,
  }, null, 2)}\n`, 'utf8');

  if (result.error) {
    appendLedger(handoff.ledgerPath, {
      schema_version: 'work-history.v1',
      event_id: nextEventId(handoff.ledgerPath, args.taskId),
      task_id: args.taskId,
      task_tier: taskTier,
      agent: 'Analyst',
      timestamp: finishedAt,
      phase: 'GENERATOR_HANDOFF',
      event_type: 'RESOURCE_FAILURE',
      status: 'HOLD',
      summary: 'Generator CLI invocation failed before completion',
      details: {
        failure_type: 'CLI_INVOCATION_ERROR',
        message: result.error.message,
        metadata_path: relativePath(metadataPath),
      },
      artifact_refs: [
        { type: 'generator_run_metadata', path: relativePath(metadataPath) },
        { type: 'generator_stderr', path: relativePath(stderrPath) },
      ],
      redaction: { applied: false, notes: 'No secret values recorded.' },
      next_action: 'Fix Claude CLI availability or command configuration and retry.',
    });
    throw result.error;
  }

  appendLedger(handoff.ledgerPath, {
    schema_version: 'work-history.v1',
    event_id: nextEventId(handoff.ledgerPath, args.taskId),
    task_id: args.taskId,
    task_tier: taskTier,
    agent: 'Analyst',
    timestamp: finishedAt,
    phase: 'GENERATOR_HANDOFF',
    event_type: 'AGENT_RESULT_RECEIVED',
    status: result.status === 0 ? 'PENDING_VALIDATION' : 'HOLD',
    summary: result.status === 0 ? 'Generator result captured' : 'Generator exited with non-zero status',
    details: {
      exit_status: result.status,
      signal: result.signal,
      output_path: relativePath(handoff.outputPath),
      stderr_path: relativePath(stderrPath),
      metadata_path: relativePath(metadataPath),
    },
    artifact_refs: [
      { type: 'generator_result', path: relativePath(handoff.outputPath) },
      { type: 'generator_run_metadata', path: relativePath(metadataPath) },
      { type: 'generator_stderr', path: relativePath(stderrPath) },
    ],
    redaction: { applied: false, notes: 'Stdout/stderr are stored as artifacts; review before sharing externally.' },
    next_action: result.status === 0 ? 'Send result to Validator according to task tier.' : 'Inspect stderr and decide retry or resource failure handling.',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[generator] ${error.message}`);
  process.exit(1);
}
