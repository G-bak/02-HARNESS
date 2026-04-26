import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taskDir = path.join(root, 'logs', 'tasks');
const qualityPath = path.join(root, 'logs', 'quality-scores.jsonl');
const strictCutoff = 38;
const staleReportPattern = /(검증|확인|검색|파싱)\s*예정|작성\s*예정|반영\s*예정/;

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

const qualityTaskIds = new Set(parseJsonl(qualityPath).map((row) => row.task_id).filter(Boolean));
const taskFiles = fs.readdirSync(taskDir)
  .filter((name) => /^TASK-\d{8}-\d{3}\.jsonl$/.test(name))
  .sort();

for (const file of taskFiles) {
  const taskId = file.replace(/\.jsonl$/, '');
  if (taskNumber(taskId) < strictCutoff) continue;

  const events = parseJsonl(path.join(taskDir, file));
  const completed = events.filter((event) => event.event_type === 'TASK_COMPLETED' || event.event === 'TASK_COMPLETED');
  if (completed.length === 0) continue;

  const finalEvent = completed.at(-1);
  const tier = finalEvent.task_tier ?? events.find((event) => event.task_tier)?.task_tier;
  const details = finalEvent.details ?? {};
  const refs = finalEvent.artifact_refs ?? [];
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
  }

  if (details.branch_required === false && !details.branch_omission_reason) {
    reportError(`${taskId}: branch_required=false requires branch_omission_reason`);
  }
}

for (const reportFile of fs.readdirSync(path.join(root, 'reports')).filter((name) => /^TASK-\d{8}-\d{3}\.md$/.test(name))) {
  const reportPath = path.join(root, 'reports', reportFile);
  const report = fs.readFileSync(reportPath, 'utf8');
  if (staleReportPattern.test(report)) {
    reportError(`${path.join('reports', reportFile)}: contains stale pending wording`);
  }
}

if (errors > 0) {
  console.error(`[FAIL] Completion gate check failed with ${errors} error(s)`);
  process.exit(1);
}

console.log('[PASS] Completion gates and completed reports look consistent');
