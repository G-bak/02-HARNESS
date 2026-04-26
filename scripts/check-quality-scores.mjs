import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const qualityPath = path.join(root, 'logs', 'quality-scores.jsonl');
const recentCount = 5;

let errors = 0;

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
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

function taskNumber(taskId) {
  const match = taskId?.match(/TASK-(\d{8})-(\d{3})$/);
  if (!match) return 0;
  return Number(`${match[1]}${match[2]}`);
}

const rows = parseJsonl(qualityPath);

for (const [index, row] of rows.entries()) {
  if (!row.task_id) reportError(`logs/quality-scores.jsonl:${index + 1}: missing task_id`);
  if (!Number.isFinite(Number(row.total_score))) reportError(`logs/quality-scores.jsonl:${index + 1}: missing numeric total_score`);
  if (!row.grade) reportError(`logs/quality-scores.jsonl:${index + 1}: missing grade`);
  if (!row.recorded_at) reportError(`logs/quality-scores.jsonl:${index + 1}: missing recorded_at`);
}

const sorted = [...rows].sort((a, b) => {
  const timeDiff = Date.parse(a.recorded_at) - Date.parse(b.recorded_at);
  if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
  return taskNumber(a.task_id) - taskNumber(b.task_id);
});

const recent = sorted.slice(-recentCount);
const average = recent.length
  ? recent.reduce((sum, row) => sum + Number(row.total_score), 0) / recent.length
  : 0;

if (errors > 0) {
  console.error(`[FAIL] Quality score check failed with ${errors} error(s)`);
  process.exit(1);
}

const recentIds = recent.map((row) => row.task_id).join(', ') || 'none';
console.log(`[PASS] ${rows.length} quality score row(s) parsed; recent ${recent.length} by recorded_at/task_id = ${recentIds}; average=${average.toFixed(1)}`);
