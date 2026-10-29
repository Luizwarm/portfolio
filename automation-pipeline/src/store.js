import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Tiny JSON store with atomic writes (write temp file, then rename).
 * Writes are serialized through a promise chain so concurrent requests
 * can never interleave and corrupt the file.
 */
export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this.writeChain = Promise.resolve();
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
      this.data.leads ??= [];
      this.data.stats ??= emptyStats();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.data = { leads: [], stats: emptyStats() };
      await this.flush();
    }
    return this.data;
  }

  flush() {
    const snapshot = `${JSON.stringify(this.data, null, 2)}\n`;
    const tmp = `${this.filePath}.tmp`;

    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(tmp, snapshot, 'utf8');
      await rename(tmp, this.filePath);
    });

    return this.writeChain;
  }
}

export function emptyStats() {
  return { received: 0, duplicates: 0, invalid: 0, synced: 0, failed: 0 };
}
