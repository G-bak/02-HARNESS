import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taskDir = path.join(root, 'logs', 'tasks');
const strictCutoff = 38;
const validTaskStatuses = new Set(['ACTIVE', 'HOLD', 'PENDING_VALIDATION', 'RETRYING', 'COMPLETE', 'PARTIAL', 'FAILED']);

let errors = 0;
let warnings = 0;

function taskNumber(taskId) {
  const match = taskId?.match(/TASK-\d{8}-(\d{3})$/);
  return match ? Number(match[1]) : 0;
}

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
}

function reportWarning(message) {
  warnings += 1;
  console.warn(`[WARN] ${message}`);
}

if (!fs.existsSync(taskDir)) {
  reportError('logs/tasks directory not found');
  process.exit(1);
}

const files = fs.readdirSync(taskDir)
  .filter((name) => /^TASK-\d{8}-\d{3}\.jsonl$/.test(name))
  .sort();

for (const file of files) {
  const fullPath = path.join(taskDir, file);
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const events = [];

  lines.forEach((line, index) => {
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      reportError(`${file}:${index + 1}: invalid JSON (${error.message})`);
    }
  });

  if (events.length === 0) {
    reportError(`${file}: empty ledger`);
    continue;
  }

  const taskId = file.replace(/\.jsonl$/, '');
  const hasCreated = events.some((event) => event.event_type === 'TASK_CREATED' || event.event === 'TASK_CREATED');
  const completed = events.filter((event) => event.event_type === 'TASK_COMPLETED' || event.event === 'TASK_COMPLETED');

  if (!hasCreated) {
    reportError(`${file}: missing TASK_CREATED`);
  }

  for (const event of events) {
    if (event.task_id && event.task_id !== taskId) {
      reportError(`${file}: event task_id ${event.task_id} does not match filename`);
    }

    if (event.status && !validTaskStatuses.has(event.status)) {
      reportError(`${file}: invalid task status ${event.status}`);
    }
  }

  if (completed.length > 1) {
    reportWarning(`${file}: multiple TASK_COMPLETED events; verify this is a correction history, not new work on a closed task`);
  }

  const strict = taskNumber(taskId) >= strictCutoff;
  if (strict && completed.length > 0) {
    const finalEvent = completed.at(-1);
    const tier = finalEvent.task_tier ?? events.find((event) => event.task_tier)?.task_tier;
    const details = finalEvent.details ?? {};
    const refs = finalEvent.artifact_refs ?? [];
    const reportPath = refs.find((ref) => ref.type === 'report')?.path ?? details.report_path;
    const hasQuality = Boolean(details.quality_score)
      || refs.some((ref) => ref.type === 'quality_score')
      || Boolean(details.quality_score_skipped_reason);

    if ((tier === 'Tier2' || tier === 'Tier3') && !reportPath) {
      reportError(`${file}: ${tier} completion missing report artifact`);
    }

    if ((tier === 'Tier2' || tier === 'Tier3') && !hasQuality) {
      reportError(`${file}: ${tier} completion missing quality score or skip reason`);
    }

    if (!refs.some((ref) => ref.type === 'session') && !details.session_log_skipped_reason) {
      reportError(`${file}: completed strict-era task missing session artifact or skip reason`);
    }
  }
}

if (errors > 0) {
  console.error(`[FAIL] Ledger validation failed with ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`[PASS] ${files.length} task ledger file(s) parsed; ${warnings} warning(s)`);
