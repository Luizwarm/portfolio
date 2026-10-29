import { createServer } from 'node:http';
import { readFile, writeFile, appendFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize as normalizePath, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { validateSubscriber } from './src/validate.js';
import { JsonStore } from './src/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const DATA_DIR = join(__dirname, 'data');

const PORT = Number(process.env.PORT) || 4320;

const store = new JsonStore(join(DATA_DIR, 'subscribers.json'));
let data = { subscribers: [] };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Very small in-memory rate limiter: max 6 submissions per IP per minute.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_HITS = 6;

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((ts) => now - ts < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

async function readJson(req, limit = 20_000) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error('payload too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('body must be valid JSON'), { statusCode: 400 });
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalizePath(join(PUBLIC_DIR, rel));

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
    return sendJson(res, 403, { error: 'forbidden' });
  }

  try {
    const body = await readFile(filePath);
    const ext = rel.slice(rel.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

async function appendCsv(subscriber) {
  await mkdir(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, 'subscribers.csv');

  try {
    await access(file);
  } catch {
    await writeFile(file, 'name,email,role,createdAt\n', 'utf8');
  }

  const line = [subscriber.name, subscriber.email, subscriber.role, subscriber.createdAt]
    .map(csvCell)
    .join(',');

  await appendFile(file, `${line}\n`, 'utf8');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function handleSubscribe(req, res) {
  const ip = req.socket.remoteAddress ?? 'unknown';

  if (rateLimited(ip)) {
    return sendJson(res, 429, { error: 'Too many attempts. Please try again in a minute.' });
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    return sendJson(res, err.statusCode ?? 400, { error: err.message });
  }

  // Honeypot: real users never fill this hidden field.
  if (String(payload.company_website ?? '').trim() !== '') {
    return sendJson(res, 200, { ok: true, position: data.subscribers.length });
  }

  const { valid, errors, subscriber } = validateSubscriber(payload);

  if (!valid) {
    return sendJson(res, 422, { error: 'validation failed', errors });
  }

  const existing = data.subscribers.find((s) => s.email === subscriber.email);

  if (existing) {
    return sendJson(res, 200, {
      ok: true,
      duplicate: true,
      position: existing.position,
      count: data.subscribers.length,
    });
  }

  const record = {
    id: randomUUID(),
    ...subscriber,
    createdAt: new Date().toISOString(),
    position: data.subscribers.length + 1,
  };

  data.subscribers.push(record);
  await store.flush();
  await appendCsv(record);

  sendJson(res, 201, {
    ok: true,
    position: record.position,
    count: data.subscribers.length,
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'POST' && url.pathname === '/api/subscribe') {
      return await handleSubscribe(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/count') {
      return sendJson(res, 200, { count: data.subscribers.length });
    }
    if (req.method === 'GET') {
      return await serveStatic(res, url.pathname);
    }
    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
  }
});

data = await store.load();

server.listen(PORT, () => {
  console.log(`landing-form  →  http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
