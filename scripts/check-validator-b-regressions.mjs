import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nextEventId } from './lib/ledger-events.mjs';

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-b-regressions-'));
const taskId = 'TASK-20990101-001';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function parseJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function setupWorkspace(mode) {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  const handoffDir = path.join(tempRoot, 'tasks', 'handoffs', taskId);
  const scriptsDir = path.join(tempRoot, 'scripts');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'docs', 'schemas'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'docs', 'schemas', 'validator-result.schema.json'),
    path.join(tempRoot, 'docs', 'schemas', 'validator-result.schema.json'),
  );

  writeJson(path.join(tempRoot, 'tasks', 'specs', `${taskId}.json`), {
    task_id: taskId,
    title: 'Validator-B regression fixture',
    tier: 'Tier3',
    success_criteria: ['Negative fixture must fail when required output is missing.'],
  });
  writeJson(path.join(handoffDir, 'generator-result.json'), {
    task_id: taskId,
    agent: 'Generator',
    status: 'PENDING_VALIDATION',
    change_summary: 'Intentionally omits required output for negative fixture.',
  });
  writeText(path.join(handoffDir, 'changed-file.md'), 'Regression fixture content.\n');
  writeText(path.join(tempRoot, 'logs', 'tasks', `${taskId}.jsonl`), `${JSON.stringify({
    schema_version: 'work-history.v1',
    event_id: `${taskId}-0001`,
    task_id: taskId,
    task_tier: 'Tier3',
    agent: 'Analyst',
    timestamp: '2099-01-01T00:00:00Z',
    phase: 'SPEC',
    event_type: 'TASK_CREATED',
    status: 'ACTIVE',
    summary: 'Regression fixture',
    details: { spec_path: `tasks/specs/${taskId}.json` },
    artifact_refs: [],
    redaction: { applied: false, notes: '' },
    next_action: null,
  })}\n${JSON.stringify({
    schema_version: 'work-history.v1',
    event_id: `${taskId}-0007`,
    task_id: taskId,
    task_tier: 'Tier3',
    agent: 'Analyst',
    timestamp: '2099-01-01T00:00:01Z',
    phase: 'REPORTING',
    event_type: 'AUDIT_NOTE',
    status: 'ACTIVE',
    summary: 'High suffix fixture',
    details: {},
    artifact_refs: [],
    redaction: { applied: false, notes: '' },
    next_action: null,
  })}\n`);
  writeJson(path.join(handoffDir, 'validator-b-input.json'), {
    schema_version: 'validator-handoff.v1',
    task_id: taskId,
    agent: 'Validator-B',
    invocation: {
      runtime: 'Gemini CLI',
      fresh_session_required: true,
      sandbox: 'read-only',
      approval_policy: 'never',
    },
    refs: {
      spec: `tasks/specs/${taskId}.json`,
      ledger: `logs/tasks/${taskId}.jsonl`,
      generator_result: `tasks/handoffs/${taskId}/generator-result.json`,
    },
    changed_files: [`tasks/handoffs/${taskId}/changed-file.md`],
    success_criteria: ['Negative fixture must fail when required output is missing.'],
    known_risks: [],
    forbidden_context: ['Do not include other validator artifacts.'],
    expected_output_path: `tasks/handoffs/${taskId}/validator-b-result-1.json`,
    expected_output_schema: 'docs/schemas/validator-result.schema.json',
  });

  const payload = mode === 'malformed'
    ? '{"response":"not json"}'
    : JSON.stringify({
      response: JSON.stringify({
        task_id: taskId,
        agent: 'Validator-B',
        tool: 'Gemini CLI',
        tier: 'Tier3',
        verdict: 'FAIL',
        criteria_results: [
          { criterion: 'Negative fixture must fail when required output is missing.', result: 'FAIL', detail: 'Required output is absent.' },
        ],
        errors: [
          {
            severity: 'HIGH',
            evidence_type: 'SPEC_MISMATCH',
            location: `tasks/handoffs/${taskId}/generator-result.json`,
            description: 'Generator result omits the required output.',
            suggestion: 'Produce the required output or update the success criterion.',
            evidence: 'Negative fixture intentionally lacks the required output.',
          },
        ],
        github_commit: null,
        tier_reclassification_needed: false,
        tier_reclassification_reason: null,
        log: [{ timestamp: '2099-01-01T00:00:02Z', action: 'negative_fixture', result: 'FAIL returned as expected.' }],
      }),
    });

  const fakeCliPath = process.platform === 'win32'
    ? path.join(scriptsDir, 'fake-gemini.cmd')
    : path.join(scriptsDir, 'fake-gemini.sh');
  if (process.platform === 'win32') {
    writeText(fakeCliPath, `@echo off\r\necho ${payload}\r\n`);
  } else {
    writeText(fakeCliPath, `#!/usr/bin/env sh\nprintf '%s\\n' '${payload.replaceAll("'", "'\\''")}'\n`);
    fs.chmodSync(fakeCliPath, 0o755);
  }
  return fakeCliPath;
}

function runValidatorB(mode, extraArgs = []) {
  const fakeCliPath = setupWorkspace(mode);
  return spawnSync(process.execPath, [
    path.join(root, 'scripts', 'run-validator-b.mjs'),
    taskId,
    '--input',
    `tasks/handoffs/${taskId}/validator-b-input.json`,
    '--gemini-bin',
    fakeCliPath,
    ...extraArgs,
  ], {
    cwd: tempRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

setupWorkspace('negative');
const ledgerPath = path.join(tempRoot, 'logs', 'tasks', `${taskId}.jsonl`);
if (nextEventId(ledgerPath, taskId) !== `${taskId}-0008`) {
  throw new Error('nextEventId must allocate max suffix + 1, not line count + 1');
}

const malformed = runValidatorB('malformed');
if (malformed.status === 0) {
  throw new Error('Malformed Validator-B output must fail the runner');
}
const malformedEvents = parseJsonl(path.join(tempRoot, 'logs', 'tasks', `${taskId}.jsonl`));
const malformedFailure = malformedEvents.find((event) => event.event_type === 'RESOURCE_FAILURE' && event.details?.resource_error_type === 'MALFORMED_OUTPUT');
if (!malformedFailure) {
  throw new Error('Malformed Validator-B output must append RESOURCE_FAILURE with resource_error_type=MALFORMED_OUTPUT');
}

const negative = runValidatorB('negative');
if (negative.status !== 0) {
  throw new Error(`Negative Validator-B fixture should be accepted as a structured FAIL result: ${negative.stderr}`);
}
const result = JSON.parse(fs.readFileSync(path.join(tempRoot, 'tasks', 'handoffs', taskId, 'validator-b-result-1.json'), 'utf8'));
if (result.verdict !== 'FAIL' || result.errors.length === 0) {
  throw new Error('Negative Validator-B fixture must produce FAIL with at least one errors[] item');
}

const dryRun = runValidatorB('negative', ['--dry-run']);
if (dryRun.status !== 0 || !dryRun.stdout.includes('--approval-mode plan')) {
  throw new Error('Validator-B dry-run must show --approval-mode plan command shape');
}

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('[PASS] Validator-B runner regressions passed');
