import fs from 'node:fs';
import path from 'node:path';

export function appendLedger(ledgerPath, event) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8');
}

export function nextEventId(ledgerPath, taskId) {
  if (!fs.existsSync(ledgerPath)) return `${taskId}-0001`;

  let maxSuffix = 0;
  for (const line of fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      const match = String(event.event_id ?? '').match(new RegExp(`^${taskId}-(\\d+)$`));
      if (match) maxSuffix = Math.max(maxSuffix, Number.parseInt(match[1], 10));
    } catch {
      // Let validate-ledger report malformed JSON; id allocation should not mask it.
    }
  }

  return `${taskId}-${String(maxSuffix + 1).padStart(4, '0')}`;
}
