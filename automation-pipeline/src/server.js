import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize as normalizePath, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { normalizeLead, dedupeKey } from './normalize.js';
import { JsonStore, emptyStats } from './store.js';
import { createLogger } from './logger.js';
import { postWithRetry } from './sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const DATA_DIR = join(ROOT, 'data');

const PORT = Number(process.env.PORT) || 4310;
const CRM_URL = process.env.CRM_URL || `http://127.0.0.1:${PORT}/mock-crm/leads`;

const store = new JsonStore(join(DATA_DIR, 'leads.json'));
const log = createLogger(join(DATA_DIR, 'audit.log'));

const seenEmails = new Set();
let data = { leads: [], stats: emptyStats() };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req, limit = 1_000_000) {
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
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

async function handleLead(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    return sendJson(res, err.statusCode ?? 400, { error: err.message });
  }

  const { errors, lead } = normalizeLead(payload);

  if (errors.length > 0) {
    data.stats.invalid++;
    await store.flush();
    await log('warn', 'lead.invalid', { errors });
    return sendJson(res, 422, { error: 'validation failed', details: errors });
  }

  data.stats.received++;
  const key = dedupeKey(lead);

  if (seenEmails.has(key)) {
    data.stats.duplicates++;
    await store.flush();
    await log('info', 'lead.duplicate', { email: lead.email });
    return sendJson(res, 409, { error: 'duplicate lead', email: lead.email });
  }

  seenEmails.add(key);

  const record = { id: randomUUID(), ...lead, status: 'pending' };
  data.leads.unshift(record);
  await store.flush();
  await log('info', 'lead.accepted', { id: record.id, email: record.email });

  // Respond first: the client should not wait for a flaky CRM.
  sendJson(res, 201, { ok: true, lead: record });

  const result = await postWithRetry(CRM_URL, record);

  record.status = result.ok ? 'synced' : 'failed';
  record.syncAttempts = result.attempts;
  if (result.ok) data.stats.synced++;
  else data.stats.failed++;

  await store.flush();
  await log(result.ok ? 'info' : 'error', 'crm.sync', {
    id: record.id,
    ok: result.ok,
    attempts: result.attempts,
    error: result.error,
  });
}

/** Simulates an unreliable third-party CRM: ~30% of calls fail with 503. */
async function handleMockCrm(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: 'bad json' });
  }

  await new Promise((resolve) => setTimeout(resolve, 60));

  if (Math.random() < 0.3) {
    return sendJson(res, 503, { error: 'crm temporarily unavailable' });
  }

  sendJson(res, 201, { ok: true, id: body.id });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'POST' && url.pathname === '/webhook/lead') {
      return await handleLead(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/mock-crm/leads') {
      return await handleMockCrm(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/leads') {
      return sendJson(res, 200, { leads: data.leads.slice(0, 200) });
    }
    if (req.method === 'GET' && url.pathname === '/api/stats') {
      return sendJson(res, 200, data.stats);
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()) });
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
for (const lead of data.leads) seenEmails.add(dedupeKey(lead));

server.listen(PORT, () => {
  console.log(`automation-pipeline  →  http://localhost:${PORT}`);
  console.log(`mock CRM target      →  ${CRM_URL}`);
  console.log(`webhook endpoint     →  POST http://localhost:${PORT}/webhook/lead`);
});

function shutdown() {
  console.log('\nshutting down...');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
