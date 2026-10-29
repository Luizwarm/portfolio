# Automation Pipeline

A small, production-minded **webhook ingestion pipeline** written in plain Node.js — **zero dependencies**.

Small businesses lose leads because data arrives messy, duplicated, or because a third-party CRM is down for a second. This service shows how to fix all three in ~300 lines.

![dashboard](https://img.shields.io/badge/dashboard-live-4f8cff) ![node](https://img.shields.io/badge/node-%3E%3D20-2ea043) ![deps](https://img.shields.io/badge/dependencies-0-blue)

## What it does

```
incoming webhook
      │
      ▼
 validate + normalize ──► invalid?  ──► 422 + audit log
      │
      ▼
 deduplicate by email ──► exists?   ──► 409 + audit log
      │
      ▼
 persist (atomic JSON write)
      │
      ▼
 respond 201 immediately
      │
      ▼
 sync to CRM with exponential backoff + jitter
      │
      ├─ success ──► status: synced
      └─ failure ──► status: failed (logged, retried 4x)
```

## Features

- **Validation that reports every error at once** instead of failing on the first one
- **Normalization**: trims names, lowercases and validates emails, keeps phone digits only, sanitizes sources
- **Deduplication** by email, persisted across restarts
- **Atomic persistence** (write to temp file → rename) with serialized writes, so concurrent requests cannot corrupt the file
- **Append-only JSONL audit log** for every accepted, rejected and duplicated lead
- **Retrying outbound sync** with exponential backoff + jitter and a hard timeout
- **Responds first, syncs later** — a slow CRM never blocks the client
- **Live dashboard** with auto-refresh, no frontend framework
- **Graceful shutdown** on SIGINT/SIGTERM

## Run it

```bash
npm start        # http://localhost:4310
npm run seed     # in a second terminal: sends 23 sample records
```

Then open <http://localhost:4310>.

The built-in `POST /mock-crm/leads` endpoint simulates an unreliable CRM (it fails ~30% of the time) so you can watch the retry logic work.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/lead` | Ingest a lead. `201` accepted, `409` duplicate, `422` invalid |
| `GET` | `/api/leads` | Latest 200 leads |
| `GET` | `/api/stats` | Counters: received, duplicates, invalid, synced, failed |
| `GET` | `/health` | Uptime check |
| `POST` | `/mock-crm/leads` | Simulated flaky CRM (demo only) |

**Example**

```bash
curl -X POST http://localhost:4310/webhook/lead \
  -H "content-type: application/json" \
  -d '{"name":"Ana Silva","email":"ANA@example.com","phone":"+55 11 98888-7777","source":"Landing Page"}'
```

```json
{
  "ok": true,
  "lead": {
    "id": "6b1f…",
    "name": "Ana Silva",
    "email": "ana@example.com",
    "phone": "5511988887777",
    "source": "landingpage",
    "receivedAt": "2026-10-29T12:00:00.000Z",
    "status": "pending"
  }
}
```

## Project structure

```
src/
  server.js      HTTP server, routes, pipeline orchestration
  normalize.js   validation + normalization (pure, easy to unit test)
  store.js       atomic JSON persistence
  logger.js      queued JSONL audit log
  sync.js        retrying HTTP client with backoff
public/          dashboard (vanilla HTML/CSS/JS)
scripts/seed.js  demo data generator
data/            runtime files (gitignored)
```

## Design notes

- **No dependencies** on purpose: nothing to audit, nothing to break, runs on any Node ≥ 20.
- `normalize.js` and `sync.js` have no I/O in their core paths, so they are trivially testable.
- The CRM URL is configurable via `CRM_URL`, so the same code points at a real CRM in production.

## Next steps (production hardening)

- Replace the JSON store with Postgres/SQLite
- Add a proper retry queue (so failed syncs survive a restart)
- Add API-key authentication on the webhook
- Add unit tests with `node:test`
