import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const taskDir = path.join(root, 'logs', 'tasks');
const qualityPath = path.join(root, 'logs', 'quality-scores.jsonl');
const strictCutoff = 38;
const staleReportPattern = /(검증|확인|검색|파싱)\s*예정|작성\s*예정|반영\s*예정/;
const validTiers = new Set(['Tier1', 'Tier2', 'Tier3']);

let errors = 0;

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
}

function taskNumber(taskId) {
  const match = taskId.match(/TASK-\d{8}-(\d{3})$/);
  return match ? Number(match[1]) : 0;
}

function parseJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        reportError(`${path.relative(root, filePath)}:${index + 1}: invalid JSON (${error.message})`);
        return null;
      }
    })
    .filter(Boolean);
}

function eventType(event) {
  return event.event_type ?? event.event;
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

function correctionEvents(events) {
  return events.filter((event) => eventType(event) === 'CORRECTION');
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

function hasEvent(events, type) {
  return events.some((event) => eventType(event) === type);
}

function gitDirtyFiles() {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function latestSessionFile() {
  const sessionDir = path.join(root, 'logs', 'sessions');
  if (!fs.existsSync(sessionDir)) return null;

  const files = fs.readdirSync(sessionDir)
    .filter((name) => /^SESSION-\d{8}-\d{3}\.md$/.test(name))
    .sort();

  return files.length > 0 ? path.join(sessionDir, files.at(-1)) : null;
}

function sectionBody(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^## ${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s|\\z)`, 'm'));
  return match ? match[1].trim() : '';
}

function currentStateHasNoActiveTask() {
  const statePath = path.join(root, 'CURRENT_STATE.md');
  if (!fs.existsSync(statePath)) return false;

  const state = fs.readFileSync(statePath, 'utf8');
  return /현재 진행 중인 Task 없음/.test(state);
}

function activeTaskIdsFromLedgers(files) {
  const active = new Set();

  for (const file of files) {
    const taskId = file.replace(/\.jsonl$/, '');
    const events = parseJsonl(path.join(taskDir, file));
    const created = events.some((event) => eventType(event) === 'TASK_CREATED');
    const completed = events.some((event) => eventType(event) === 'TASK_COMPLETED');
    const finalStatus = [...events].reverse().find((event) => event.status)?.status;

    if (created && !completed && finalStatus !== 'COMPLETE' && finalStatus !== 'FAILED') {
      active.add(taskId);
    }
  }

  return active;
}

const qualityTaskIds = new Set(parseJsonl(qualityPath).map((row) => row.task_id).filter(Boolean));
const insightsPath = path.join(root, 'logs', 'insights.jsonl');
const allInsights = parseJsonl(insightsPath);
const insightsByTask = new Map();
for (const insight of allInsights) {
  if (!insight.source_task) continue;
  if (!insightsByTask.has(insight.source_task)) {
    insightsByTask.set(insight.source_task, []);
  }
  insightsByTask.get(insight.source_task).push(insight);
}
const dirtyFiles = gitDirtyFiles();
const latestSessionPath = latestSessionFile();
const taskFiles = fs.readdirSync(taskDir)
  .filter((name) => /^TASK-\d{8}-\d{3}\.jsonl$/.test(name))
  .sort();
const activeTaskIds = activeTaskIdsFromLedgers(taskFiles);
const noActiveTask = currentStateHasNoActiveTask() && activeTaskIds.size === 0;
const latestCompletedTaskId = taskFiles
  .map((file) => file.replace(/\.jsonl$/, ''))
  .filter((taskId) => {
    const events = parseJsonl(path.join(taskDir, `${taskId}.jsonl`));
    return events.some((event) => eventType(event) === 'TASK_COMPLETED');
  })
  .sort((a, b) => taskNumber(a) - taskNumber(b))
  .at(-1);

for (const file of taskFiles) {
  const taskId = file.replace(/\.jsonl$/, '');
  if (taskNumber(taskId) < strictCutoff) continue;

  const events = parseJsonl(path.join(taskDir, file));
  const completed = events.filter((event) => eventType(event) === 'TASK_COMPLETED');
  if (completed.length === 0) continue;

  const finalEvent = completed.at(-1);
  const tier = taskTier(events, finalEvent);
  const details = effectiveDetails(finalEvent, events);
  const refs = effectiveRefs(finalEvent, events);
  const reportPath = refs.find((ref) => ref.type === 'report')?.path ?? details.report_path;

  if (tier === 'Tier2' || tier === 'Tier3') {
    if (!reportPath) {
      reportError(`${taskId}: ${tier} completion requires reports/${taskId}.md or report artifact`);
    } else {
      const absoluteReport = path.join(root, reportPath);
      if (!fs.existsSync(absoluteReport)) {
        reportError(`${taskId}: report artifact does not exist (${reportPath})`);
      } else {
        const report = fs.readFileSync(absoluteReport, 'utf8');
        if (staleReportPattern.test(report)) {
          reportError(`${taskId}: completed report contains stale pending wording (${reportPath})`);
        }
      }
    }

    const hasQualityRef = refs.some((ref) => ref.type === 'quality_score') || Boolean(details.quality_score);
    if (!hasQualityRef && !qualityTaskIds.has(taskId)) {
      reportError(`${taskId}: ${tier} completion requires quality score artifact or logs/quality-scores.jsonl row`);
    }

    if (!hasEvent(events, 'VALIDATION_RESULT') && !details.validation_omission_reason) {
      reportError(`${taskId}: ${tier} completion requires VALIDATION_RESULT or validation_omission_reason`);
    }

    const branchRequired = details.branch_required !== false;
    if (branchRequired && !hasEvent(events, 'MERGE_COMPLETED') && !details.merge_omission_reason) {
      reportError(`${taskId}: git-mode ${tier} completion requires MERGE_COMPLETED or merge_omission_reason`);
    }
  }

  if (details.branch_required === false && !details.branch_omission_reason) {
    reportError(`${taskId}: branch_required=false requires branch_omission_reason`);
  }

  // Insight category enforcement gate (per work-history-policy v1.14)
  // For each insight whose source_task matches this Task and which carries a `category` field,
  // require that actionable_doc_change and gotcha categories have applied_to_doc.status === 'applied'.
  // Legacy insights without `category` are exempt.
  const insightsForTask = insightsByTask.get(taskId) ?? [];
  for (const insight of insightsForTask) {
    if (!insight.category) continue;
    if (insight.category !== 'actionable_doc_change' && insight.category !== 'gotcha') continue;

    const insightId = insight.id ?? '(unknown)';
    const appliedStatus = insight.applied_to_doc?.status;

    if (appliedStatus !== 'applied') {
      reportError(
        `${taskId}: insight ${insightId} category=${insight.category} requires applied_to_doc.status=applied (got ${appliedStatus ?? 'missing'})`,
      );
      continue;
    }

    if (!insight.applied_to_doc?.commit) {
      reportError(
        `${taskId}: insight ${insightId} category=${insight.category} applied_to_doc.commit is required`,
      );
    }

    if (insight.category === 'gotcha' && !insight.applied_to_doc?.section) {
      reportError(
        `${taskId}: insight ${insightId} category=gotcha applied_to_doc.section is required (which guide section the warning was added to)`,
      );
    }
  }

  if (
    taskId === latestCompletedTaskId
    && taskNumber(taskId) >= strictCutoff
    && noActiveTask
    && dirtyFiles
    && dirtyFiles.length > 0
    && details.branch_required !== false
    && !details.git_dirty_allowed_reason
  ) {
    reportError(`${taskId}: completed git-mode task requires clean worktree or git_dirty_allowed_reason`);
  }
}

for (const reportFile of fs.readdirSync(path.join(root, 'reports')).filter((name) => /^TASK-\d{8}-\d{3}\.md$/.test(name))) {
  const reportPath = path.join(root, 'reports', reportFile);
  const report = fs.readFileSync(reportPath, 'utf8');
  if (staleReportPattern.test(report)) {
    reportError(`${path.join('reports', reportFile)}: contains stale pending wording`);
  }
}

if (latestSessionPath && noActiveTask) {
  const session = fs.readFileSync(latestSessionPath, 'utf8');
  const nextSteps = sectionBody(session, '다음 단계');
  const hasActionBullets = /^-\s+(?!없음\b).+/m.test(nextSteps);

  if (hasActionBullets) {
    reportError(`${path.relative(root, latestSessionPath)}: CURRENT_STATE has no active task but session next steps still list pending actions`);
  }
}

if (errors > 0) {
  console.error(`[FAIL] Completion gate check failed with ${errors} error(s)`);
  process.exit(1);
}

console.log('[PASS] Completion gates and completed reports look consistent');
