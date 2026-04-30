import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaDir = path.join(root, 'docs', 'schemas');
const generatorSchemaPath = path.join(schemaDir, 'generator-handoff.schema.json');
const validatorSchemaPath = path.join(schemaDir, 'validator-handoff.schema.json');
const retryFixturePath = path.join(root, 'tasks', 'handoffs', 'TASK-20260429-006', 'generator-input-retry-2.json');

let errors = 0;

function reportError(message) {
  errors += 1;
  console.error(`[FAIL] ${message}`);
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    reportError(`${relativePath(filePath)} is not valid JSON (${error.message})`);
    return null;
  }
}

for (const fileName of fs.readdirSync(schemaDir).filter((name) => name.endsWith('.schema.json'))) {
  readJson(path.join(schemaDir, fileName));
}

const generatorSchema = readJson(generatorSchemaPath);
const validatorSchema = readJson(validatorSchemaPath);
const retryFixture = readJson(retryFixturePath);

function collectFiles(directoryPath, predicate) {
  if (!fs.existsSync(directoryPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

if (generatorSchema && retryFixture) {
  const properties = generatorSchema.properties ?? {};
  if (!Object.hasOwn(properties, 'retry')) {
    reportError('generator-handoff.schema.json must declare optional top-level retry so retry handoffs survive strict validation');
  }

  for (const key of generatorSchema.required ?? []) {
    if (!Object.hasOwn(retryFixture, key)) {
      reportError(`${relativePath(retryFixturePath)} is missing required generator handoff field: ${key}`);
    }
  }

  if (generatorSchema.additionalProperties === false) {
    for (const key of Object.keys(retryFixture)) {
      if (!Object.hasOwn(properties, key)) {
        reportError(`${relativePath(retryFixturePath)} uses top-level field not allowed by generator-handoff.schema.json: ${key}`);
      }
    }
  }

  if (!retryFixture.retry || retryFixture.retry.attempt_no !== 2) {
    reportError(`${relativePath(retryFixturePath)} must remain a retry fixture with retry.attempt_no=2`);
  }
}

const validatorBFixturePaths = [
  ...collectFiles(path.join(root, 'tasks', 'handoffs'), (filePath) => path.basename(filePath) === 'validator-b-input.json'),
  ...collectFiles(path.join(root, 'tasks', 'fixtures'), (filePath) => path.basename(filePath) === 'validator-b-input.json'),
].sort();

if (validatorSchema && validatorBFixturePaths.length === 0) {
  reportError('At least one Validator-B handoff fixture is required');
}

for (const validatorBFixturePath of validatorBFixturePaths) {
  const validatorBFixture = readJson(validatorBFixturePath);
  if (!validatorBFixture) continue;

  const properties = validatorSchema.properties ?? {};
  for (const key of validatorSchema.required ?? []) {
    if (!Object.hasOwn(validatorBFixture, key)) {
      reportError(`${relativePath(validatorBFixturePath)} is missing required validator handoff field: ${key}`);
    }
  }

  if (validatorSchema.additionalProperties === false) {
    for (const key of Object.keys(validatorBFixture)) {
      if (!Object.hasOwn(properties, key)) {
        reportError(`${relativePath(validatorBFixturePath)} uses top-level field not allowed by validator-handoff.schema.json: ${key}`);
      }
    }
  }

  if (validatorBFixture.agent !== 'Validator-B') {
    reportError(`${relativePath(validatorBFixturePath)} must remain a Validator-B handoff fixture`);
  }
  if (validatorBFixture.invocation?.runtime !== 'Gemini CLI') {
    reportError(`${relativePath(validatorBFixturePath)} must use Gemini CLI runtime`);
  }
  if (validatorBFixture.invocation?.sandbox !== 'read-only') {
    reportError(`${relativePath(validatorBFixturePath)} must use read-only sandbox`);
  }

  const guardedValues = [
    ...Object.values(validatorBFixture.refs ?? {}),
    ...(validatorBFixture.changed_files ?? []),
    ...(validatorBFixture.previous_failures ?? []).map((failure) => JSON.stringify(failure)),
  ].filter((value) => typeof value === 'string');
  const blocked = guardedValues.find((value) => /validator[-_]?a|codex/i.test(value));
  if (blocked) {
    reportError(`${relativePath(validatorBFixturePath)} must not include Validator-A or Codex references in refs/changed_files/previous_failures: ${blocked}`);
  }
}

if (errors > 0) {
  console.error(`[FAIL] Handoff validation failed with ${errors} error(s)`);
  process.exit(1);
}

console.log('[PASS] Handoff schemas and retry fixture look consistent');
