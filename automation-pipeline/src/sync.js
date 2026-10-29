/**
 * POST with exponential backoff + jitter and a hard timeout.
 * Real CRMs go down for a second; a lead must not be lost because of it.
 */
export async function postWithRetry(url, body, options = {}) {
  const {
    retries = 4,
    baseDelayMs = 300,
    timeoutMs = 5000,
    fetchImpl = fetch,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) return { ok: true, attempts: attempt + 1 };

      lastError = new Error(`remote responded ${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 100;
      await sleep(delay);
    }
  }

  return {
    ok: false,
    attempts: retries + 1,
    error: lastError?.message ?? 'unknown error',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
