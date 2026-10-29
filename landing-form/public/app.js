const form = document.getElementById('form');
const success = document.getElementById('success');
const positionEl = document.getElementById('position');
const counterEl = document.getElementById('counter');
const submitBtn = document.getElementById('submit');
const formError = document.getElementById('form-error');

const inputs = {
  name: document.getElementById('name'),
  email: document.getElementById('email'),
  role: document.getElementById('role'),
};

/* ---------- inline validation ---------- */

function setError(field, message) {
  const el = document.querySelector(`[data-err="${field}"]`);
  if (el) el.textContent = message ?? '';
  if (inputs[field]) inputs[field].setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearErrors() {
  for (const field of Object.keys(inputs)) setError(field, '');
  formError.textContent = '';
}

function validate(values) {
  const errors = {};

  if (values.name.trim().length < 2) {
    errors.name = 'Please enter your name.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  return errors;
}

/* ---------- submit ---------- */

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const values = {
    name: inputs.name.value,
    email: inputs.email.value,
    role: inputs.role.value,
    company_website: document.getElementById('company_website').value,
  };

  const clientErrors = validate(values);
  if (Object.keys(clientErrors).length > 0) {
    for (const [field, message] of Object.entries(clientErrors)) setError(field, message);
    inputs[clientErrors.name ? 'name' : 'email'].focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Joining…';

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (body.errors) {
        for (const [field, message] of Object.entries(body.errors)) setError(field, message);
      } else {
        formError.textContent = body.error || 'Something went wrong. Please try again.';
      }
      return;
    }

    positionEl.textContent = body.position ?? '—';
    form.hidden = true;
    success.hidden = false;
    success.focus?.();
    updateCounter();
  } catch {
    formError.textContent = 'Network error. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get early access';
  }
});

/* ---------- live counter ---------- */

async function updateCounter() {
  try {
    const { count } = await fetch('/api/count').then((r) => r.json());
    counterEl.textContent = count > 0 ? `${count} freelancer${count === 1 ? '' : 's'} already waiting` : '';
  } catch {
    counterEl.textContent = '';
  }
}

updateCounter();
