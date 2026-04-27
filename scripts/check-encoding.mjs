import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_EXTS = new Set(['.html', '.js', '.json', '.md', '.sql', '.toml', '.css']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'logs']);

const suspiciousPatterns = [
  { name: 'replacement character', regex: /\uFFFD/ },
  { name: 'question-mark mojibake', regex: /\?{3,}/ },
  { name: 'Korean mojibake fragment', regex: /\?(?:쒕|섎|꾩|댁|ㅻ|쒗|좏|묓|뚮|몄|쇱|대|덉|)/ },
  { name: 'CJK mojibake fragment', regex: /[癰袁]/ },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (TARGET_EXTS.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const findings = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: rel,
          line: index + 1,
          pattern: pattern.name,
          text: line.trim().slice(0, 160),
        });
      }
    }
  });
}

if (findings.length) {
  console.error('Suspicious encoding artifacts found:');
  for (const item of findings) {
    console.error(`${item.file}:${item.line} [${item.pattern}] ${item.text}`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');
