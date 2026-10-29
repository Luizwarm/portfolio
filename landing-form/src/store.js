import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Atomic JSON store: write a temp file, then rename over the original. */
export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { subscribers: [] };
    this.chain = Promise.resolve();
  }

  async load() {
    try {
      this.data = JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await this.flush();
    }
    this.data.subscribers ??= [];
    return this.data;
  }

  flush() {
    const snapshot = `${JSON.stringify(this.data, null, 2)}\n`;
    const tmp = `${this.filePath}.tmp`;

    this.chain = this.chain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(tmp, snapshot, 'utf8');
      await rename(tmp, this.filePath);
    });

    return this.chain;
  }
}
