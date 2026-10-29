import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Append-only JSONL audit logger.
 * Writes are queued so log lines never interleave, and a failed log write
 * never breaks the request that produced it.
 */
export function createLogger(filePath) {
  let queue = Promise.resolve();

  return function log(level, event, data = {}) {
    const line = `${JSON.stringify({ ts: new Date().toISOString(), level, event, ...data })}\n`;

    queue = queue
      .then(() => mkdir(dirname(filePath), { recursive: true }))
      .then(() => appendFile(filePath, line, 'utf8'))
      .catch((err) => console.error('[audit] write failed:', err.message));

    return queue;
  };
}
