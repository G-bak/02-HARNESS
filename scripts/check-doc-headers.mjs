import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const statePath = path.join(root, 'CURRENT_STATE.md');

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

if (!fs.existsSync(statePath)) {
  fail('CURRENT_STATE.md not found');
  process.exit();
}

const state = read(statePath);
const rows = [...state.matchAll(/^\|\s*[^|]+\|\s*`([^`]+)`\s*\|\s*(v?[0-9]+\.[0-9]+)\s*\|\s*(20\d{2}-\d{2}-\d{2})\s*\|/gm)]
  .map((m) => ({ file: m[1], expectedVersion: m[2], expectedDate: m[3] }));

if (rows.length === 0) {
  fail('No authority table rows found in CURRENT_STATE.md');
}

for (const row of rows) {
  const filePath = path.join(root, row.file);
  if (!fs.existsSync(filePath)) {
    fail(`${row.file}: file not found`);
    continue;
  }

  const header = read(filePath).split(/\r?\n/).slice(0, 10).join('\n');
  const versionMatch = header.match(/(?:버전|Version):\*\*\s*v?([0-9]+\.[0-9]+)/)
    ?? header.match(/(?:버전|Version):\s*v?([0-9]+\.[0-9]+)/);
  const dateMatch = header.match(/20\d{2}-\d{2}-\d{2}/);

  const actualVersion = versionMatch ? `v${versionMatch[1]}` : null;
  const actualDate = dateMatch ? dateMatch[0] : null;

  if (actualVersion !== row.expectedVersion) {
    fail(`${row.file}: version mismatch, expected ${row.expectedVersion}, got ${actualVersion ?? 'NONE'}`);
  }

  if (actualDate !== row.expectedDate) {
    fail(`${row.file}: date mismatch, expected ${row.expectedDate}, got ${actualDate ?? 'NONE'}`);
  }
}

if (!process.exitCode) {
  console.log(`[PASS] ${rows.length} authority document headers match CURRENT_STATE.md`);
}
