const secretPatterns = [
  {
    name: 'openai_or_similar_sk_token',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/i,
  },
  {
    name: 'bearer_token',
    pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/i,
  },
  {
    name: 'password_assignment',
    pattern: /["']?\b(?:password|passwd|pwd)\b["']?\s*[:=]\s*["']?[^"'\s]{4,}/i,
  },
  {
    name: 'secret_assignment',
    pattern: /["']?\b(?:api[_-]?key|secret|token)\b["']?\s*[:=]\s*["']?[^"'\s]{8,}/i,
  },
  {
    name: 'aws_access_key_id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
];

export function assertNoSecretLikeContent(text, label = 'content') {
  const matches = secretPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);

  if (matches.length > 0) {
    throw new Error(
      `Potential secret-like content found in ${label}: ${matches.join(', ')}. Remove the value and pass only redacted references or environment variable names.`,
    );
  }
}
