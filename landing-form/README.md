# Landing Page + Form

A conversion-focused landing page with a working waitlist form, built in plain Node.js and vanilla HTML/CSS/JS — **zero dependencies**.

Most "landing page" portfolio pieces only look good. This one actually captures leads safely: server-side validation, honeypot anti-spam, per-IP rate limiting, deduplication, JSON + CSV persistence, and a real success state.

## Run it

```bash
npm start        # http://localhost:4320
```

Submit the form, then check `data/subscribers.json` and `data/subscribers.csv`.

## What it demonstrates

**Frontend**
- Responsive layout (mobile-first breakpoints, no framework)
- Light and dark mode via `prefers-color-scheme`
- Accessible form: labels, `aria-invalid`, `aria-live` error messages, visible focus rings
- Inline validation before hitting the network
- Optimistic success state showing the subscriber's queue position
- Respects `prefers-reduced-motion`

**Backend**
- Server-side validation as the single source of truth (never trusts the browser)
- Honeypot field that silently drops bots
- In-memory rate limiting: max 6 submissions per IP per minute
- Duplicate protection by email (idempotent retries)
- Atomic JSON persistence + append-only CSV export
- Security headers (`nosniff`, `frame-options`, `referrer-policy`)
- Path-traversal guard on static files
- 20 KB request body limit

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/subscribe` | `{ name, email, role? }` → `201` with `{ position, count }` · `422` with field errors · `429` when rate limited |
| `GET` | `/api/count` | `{ count }` of subscribers |

**Example**

```bash
curl -X POST http://localhost:4320/api/subscribe \
  -H "content-type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@studio.com","role":"Designer"}'
```

```json
{ "ok": true, "position": 1, "count": 1 }
```

## Project structure

```
server.js        HTTP server, static serving, subscribe endpoint
src/validate.js  pure validation logic
src/store.js     atomic JSON persistence
public/          landing page (HTML, CSS, vanilla JS)
data/            runtime files (gitignored)
```

## Production notes

- Replace the in-memory rate limiter with Redis if you run more than one instance
- Swap the JSON store for Postgres, and enqueue the CSV export
- Add a real email provider (Resend, Postmark) on successful subscribe
- Add analytics events (`form_view`, `form_submit`, `form_success`) to measure conversion
