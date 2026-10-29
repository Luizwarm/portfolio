const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Turns untrusted input from a webhook into a clean lead record.
 * Returns every validation error instead of failing on the first one,
 * so the caller can report all problems at once.
 */
export function normalizeLead(input = {}) {
  const errors = [];

  const name = String(input.name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  const email = String(input.email ?? '').trim().toLowerCase().slice(0, 254);

  const phoneDigits = String(input.phone ?? '').replace(/\D/g, '');
  const phone = phoneDigits.length >= 10 && phoneDigits.length <= 15 ? phoneDigits : '';

  const source = String(input.source ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40) || 'unknown';

  if (name.length < 2) errors.push('name must have at least 2 characters');
  if (!EMAIL_RE.test(email)) errors.push('email is invalid');

  return {
    errors,
    lead: {
      name,
      email,
      phone,
      source,
      receivedAt: new Date().toISOString(),
    },
  };
}

/** Email is the identity for this pipeline. */
export function dedupeKey(lead) {
  return lead.email;
}
