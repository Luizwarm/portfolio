/**
 * Sends a realistic batch of leads to a running server:
 * 18 valid, 3 duplicates and 2 invalid records.
 *
 * Usage: npm start   (in one terminal)
 *        npm run seed (in another)
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';

const FIRST = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabriela', 'Hugo',
  'Isabela', 'João', 'Karen', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Pedro',
  'Rafael', 'Sofia',
];
const LAST = [
  'Silva', 'Souza', 'Lima', 'Costa', 'Pereira', 'Almeida', 'Ferreira',
  'Rodrigues', 'Gomes', 'Martins',
];
const SOURCES = ['landing-page', 'instagram', 'referral', 'webinar', 'cold-outreach'];

const leads = FIRST.map((first, i) => ({
  name: `${first} ${LAST[i % LAST.length]}`,
  email: `${first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${LAST[i % LAST.length].toLowerCase()}@example.com`,
  phone: `+55 11 9${String(80000000 + i * 137).slice(0, 8)}`,
  source: SOURCES[i % SOURCES.length],
}));

// Duplicates: same email as an earlier lead.
leads.push({ ...leads[0] }, { ...leads[5] }, { ...leads[11] });

// Invalid: too-short name, malformed email.
leads.push({ name: 'A', email: 'not-an-email', source: 'landing-page' });
leads.push({ name: '', email: '', source: 'instagram' });

let accepted = 0;
let duplicates = 0;
let rejected = 0;

for (const lead of leads) {
  let res;
  try {
    res = await fetch(`${BASE}/webhook/lead`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lead),
    });
  } catch {
    console.error(`✗ could not reach ${BASE}. Is "npm start" running?`);
    process.exit(1);
  }

  if (res.status === 201) accepted++;
  else if (res.status === 409) duplicates++;
  else rejected++;
}

console.log(`\nsent ${leads.length} records`);
console.log(`  accepted   ${accepted}`);
console.log(`  duplicates ${duplicates}`);
console.log(`  rejected   ${rejected}`);
console.log(`\nopen ${BASE} to watch the dashboard.\n`);
