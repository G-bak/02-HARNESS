import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaDir = path.join(root, 'docs', 'schemas');
const generatorSchemaPath = path.join(schemaDir, 'generator-handoff.schema.json');
const validatorSchemaPath = path.join(schemaDir, 'validator-handoff.schema.json');
const retryFixturePath = path.join(root, 'tasks', 'handoffs', 'TASK-20260429-006', 'generator-input-retry-2.json');
const validatorBFixturePath = path.join(root, 'tasks', 'handoffs', 'TASK-20260430-001', 'validator-b-input.json');

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
const validatorBFixture = fs.existsSync(validatorBFixturePath) ? readJson(validatorBFixturePath) : null;

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

if (validatorSchema && validatorBFixture) {
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
  const serialized = JSON.stringify(validatorBFixture);
  if (/validator-a-result|Validator-A PASS|Validator-A FAIL/i.test(serialized)) {
    reportError(`${relativePath(validatorBFixturePath)} must not include Validator-A result context`);
  }
}

if (errors > 0) {
  console.error(`[FAIL] Handoff validation failed with ${errors} error(s)`);
  process.exit(1);
}

console.log('[PASS] Handoff schemas and retry fixture look consistent');
