import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const taskDir = path.join(root, 'logs', 'tasks');
const pendingPushStatuses = new Set(['PENDING_PUSH', 'PENDING_FINAL_GIT_STEP']);
const defaultStrictTaskId = 'TASK-20260429-010';

let errors = 0;

function usage() {
  console.error(`Usage:
  node scripts/check-final-git-state.mjs [options]

Options:
  --finalize              Also require clean worktree and main...origin/main sync.
  --strict-from <task>    First task_id to enforce pending push metadata. Defaults to ${defaultStrictTaskId}.
`);
}

function parseArgs(argv) {
  const args = {
    finalize: false,
    strictFrom: defaultStrictTaskId,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--finalize') {
      args.finalize = true;
    } else if (arg === '--strict-from') {
      args.strictFrom = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!/^TASK-\d{8}-\d{3}$/.test(args.strictFrom)) {
    throw new Error(`Invalid --strict-from task_id: ${args.strictFrom}`);
  }

  return args;
}

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
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
        reportError(`${relativePath(filePath)}:${index + 1}: invalid JSON (${error.message})`);
        return null;
      }
    })
    .filter(Boolean);
}

function eventType(event) {
  return event.event_type ?? event.event;
}

function taskSortKey(taskId) {
  const match = /^TASK-(\d{8})-(\d{3})$/.exec(taskId);
  if (!match) return '';
  return `${match[1]}-${match[2]}`;
}

function isAtOrAfter(taskId, strictFrom) {
  return taskSortKey(taskId) >= taskSortKey(strictFrom);
}

function correctionEvents(events) {
  return events.filter((event) => eventType(event) === 'CORRECTION');
}

function effectiveDetails(finalEvent, events) {
  const merged = { ...(finalEvent.details ?? {}) };
  for (const event of correctionEvents(events)) {
    Object.assign(merged, event.details ?? {});
  }
  return merged;
}

function latestCompletedEvent(events) {
  return events.filter((event) => eventType(event) === 'TASK_COMPLETED').at(-1) ?? null;
}

function taskStatus(finalEvent) {
  return finalEvent?.status ?? finalEvent?.details?.status ?? null;
}

function shellOutput(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function checkPendingPushMetadata(strictFrom) {
  if (!fs.existsSync(taskDir)) return;
  const files = fs.readdirSync(taskDir)
    .filter((name) => /^TASK-\d{8}-\d{3}\.jsonl$/.test(name))
    .sort();

  for (const file of files) {
    const taskId = file.replace(/\.jsonl$/, '');
    if (!isAtOrAfter(taskId, strictFrom)) continue;

    const events = parseJsonl(path.join(taskDir, file));
    const finalEvent = latestCompletedEvent(events);
    if (!finalEvent) continue;

    const status = taskStatus(finalEvent);
    if (status === 'HOLD' || status === 'PARTIAL' || status === 'FAILED') continue;

    const details = effectiveDetails(finalEvent, events);
    if (pendingPushStatuses.has(details.push_status)) {
      reportError(`${taskId}: completed task has stale push_status=${details.push_status}; append a CORRECTION with push_status=PUSHED or mark the task HOLD/PARTIAL/FAILED with a reason`);
    }

    if (pendingPushStatuses.has(details.merge_push_status)) {
      reportError(`${taskId}: completed task has stale merge_push_status=${details.merge_push_status}; append a CORRECTION with merge_push_status=PUSHED or mark the task HOLD/PARTIAL/FAILED with a reason`);
    }
  }
}

function checkCleanWorktree() {
  const status = shellOutput('git', ['status', '--porcelain']);
  if (status) {
    reportError(`finalize check requires clean worktree; git status --porcelain returned:\n${status}`);
  }
}

function checkMainOriginSync() {
  const branch = shellOutput('git', ['branch', '--show-current']);
  if (branch !== 'main') {
    reportError(`finalize check must run on main; current branch is ${branch || '(detached)'}`);
    return;
  }

  const status = shellOutput('git', ['status', '--short', '--branch']);
  const firstLine = status.split(/\r?\n/)[0] ?? '';
  if (!/^## main\.\.\.origin\/main$/.test(firstLine)) {
    reportError(`finalize check requires main and origin/main in sync; status header is: ${firstLine}`);
  }
}

const args = parseArgs(process.argv.slice(2));

checkPendingPushMetadata(args.strictFrom);
if (args.finalize) {
  checkCleanWorktree();
  checkMainOriginSync();
}

if (errors > 0) {
  console.error(`[FAIL] Final git-state check failed with ${errors} error(s)`);
  process.exit(1);
}

console.log(args.finalize
  ? '[PASS] Final git-state checks passed'
  : '[PASS] Completed task push metadata looks consistent');
