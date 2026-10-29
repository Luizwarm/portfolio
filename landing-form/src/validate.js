const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Server-side validation. The browser validates too, but the server never
 * trusts the browser: this is the only result that decides what gets stored.
 */
export function validateSubscriber(input = {}) {
  const errors = {};

  const name = String(input.name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  const email = String(input.email ?? '').trim().toLowerCase().slice(0, 254);

  const role = String(input.role ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);

  if (name.length < 2) errors.name = 'Please enter your name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    subscriber: { name, email, role },
  };
}
