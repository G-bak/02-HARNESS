import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taskDir = path.join(root, 'logs', 'tasks');
const specDir = path.join(root, 'tasks', 'specs');
const strictCutoff = 38;
const validTaskStatuses = new Set(['ACTIVE', 'HOLD', 'PENDING_VALIDATION', 'RETRYING', 'COMPLETE', 'PARTIAL', 'FAILED']);
const validTiers = new Set(['Tier1', 'Tier2', 'Tier3']);

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

function eventType(event) {
  return event.event_type ?? event.event;
}

function correctionEvents(events) {
  return events.filter((event) => eventType(event) === 'CORRECTION');
}

function hasCorrection(events, predicate) {
  return correctionEvents(events).some((event) => predicate(event.details ?? {}, event));
}

function normalizedTier(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (validTiers.has(text)) return text;
  if (/^tier\s*1$/i.test(text) || text === '1') return 'Tier1';
  if (/^tier\s*2$/i.test(text) || text === '2') return 'Tier2';
  if (/^tier\s*3$/i.test(text) || text === '3') return 'Tier3';
  return null;
}

function taskTier(events, finalEvent) {
  const candidates = [
    finalEvent.task_tier,
    finalEvent.details?.task_tier,
    finalEvent.details?.tier,
    ...events.map((event) => event.task_tier),
    ...events.map((event) => event.details?.task_tier),
    ...events.map((event) => event.details?.tier),
  ];

  for (const candidate of candidates) {
    const tier = normalizedTier(candidate);
    if (tier) return tier;
  }

  return null;
}

function effectiveRefs(finalEvent, events) {
  const refs = [...(finalEvent.artifact_refs ?? [])];

  for (const event of correctionEvents(events)) {
    for (const ref of event.artifact_refs ?? []) {
      refs.push(ref);
    }
  }

  return refs;
}

function effectiveDetails(finalEvent, events) {
  const created = events.find((event) => eventType(event) === 'TASK_CREATED');
  const merged = { ...(created?.details ?? {}), ...(finalEvent.details ?? {}) };

  for (const event of correctionEvents(events)) {
    Object.assign(merged, event.details ?? {});
  }

  return merged;
}

function hasTaskSpecSource(taskId, events) {
  const created = events.find((event) => eventType(event) === 'TASK_CREATED');
  const details = created?.details ?? {};
  const specPath = details.spec_path ? path.join(root, details.spec_path) : path.join(specDir, `${taskId}.json`);

  return Boolean(details.spec)
    || Boolean(details.spec_path && fs.existsSync(specPath))
    || fs.existsSync(path.join(specDir, `${taskId}.json`))
    || hasCorrection(events, (correctionDetails) => Boolean(correctionDetails.legacy_spec_omission_reason));
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
  const hasCreated = events.some((event) => eventType(event) === 'TASK_CREATED');
  const completed = events.filter((event) => eventType(event) === 'TASK_COMPLETED');

  if (!hasCreated) {
    reportError(`${file}: missing TASK_CREATED`);
  }

  if (taskNumber(taskId) >= strictCutoff && hasCreated && !hasTaskSpecSource(taskId, events)) {
    reportError(`${file}: strict-era TASK_CREATED requires Task Spec SSOT or legacy_spec_omission_reason CORRECTION`);
  }

  for (const event of events) {
    if (event.task_id && event.task_id !== taskId) {
      reportError(`${file}: event task_id ${event.task_id} does not match filename`);
    }

    if (event.status && !validTaskStatuses.has(event.status)) {
      const corrected = hasCorrection(events, (details) =>
        details.corrected_event_index === events.indexOf(event) + 1
        && details.corrected_status === 'COMPLETE'
      );

      const suppressed = hasCorrection(events, (details) =>
        details.corrected_event_index === events.indexOf(event) + 1
        && details.legacy_status_warning_suppressed === true
      );

      if (corrected && !suppressed) {
        reportWarning(`${file}: legacy invalid task status ${event.status} is superseded by CORRECTION`);
      } else if (corrected) {
        // Legacy value is intentionally preserved and documented by CORRECTION.
      } else {
        reportError(`${file}: invalid task status ${event.status}`);
      }
    }
  }

  if (completed.length > 1) {
    const suppressed = hasCorrection(events, (details) =>
      details.multiple_completion_warning_suppressed === true
    );

    if (!suppressed) {
      reportWarning(`${file}: multiple TASK_COMPLETED events; verify this is a correction history, not new work on a closed task`);
    }
  }

  const strict = taskNumber(taskId) >= strictCutoff;
  if (strict && completed.length > 0) {
    const finalEvent = completed.at(-1);
    const tier = taskTier(events, finalEvent);
    const details = effectiveDetails(finalEvent, events);
    const refs = effectiveRefs(finalEvent, events);
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
