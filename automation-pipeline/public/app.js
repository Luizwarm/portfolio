const statsEl = document.getElementById('stats');
const rowsEl = document.getElementById('rows');

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STAT_CARDS = [
  ['Received', 'received'],
  ['Duplicates blocked', 'duplicates'],
  ['Invalid rejected', 'invalid'],
  ['Synced to CRM', 'synced'],
  ['Sync failed', 'failed'],
];

async function refresh() {
  try {
    const [stats, payload] = await Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/leads').then((r) => r.json()),
    ]);
    renderStats(stats);
    renderRows(payload.leads ?? []);
  } catch {
    // Server was restarted or is unreachable; try again on the next tick.
  }
}

function renderStats(stats) {
  statsEl.innerHTML = STAT_CARDS.map(
    ([label, key]) => `
      <div class="card">
        <span class="label">${label}</span>
        <span class="value">${Number(stats[key] ?? 0)}</span>
      </div>`,
  ).join('');
}

function renderRows(leads) {
  if (leads.length === 0) {
    rowsEl.innerHTML =
      '<tr><td colspan="5" class="empty">No leads yet — run <code>npm run seed</code> to send a batch.</td></tr>';
    return;
  }

  rowsEl.innerHTML = leads
    .map(
      (lead) => `
      <tr>
        <td>${esc(lead.name)}</td>
        <td class="mono">${esc(lead.email)}</td>
        <td><span class="tag">${esc(lead.source)}</span></td>
        <td><span class="badge ${esc(lead.status)}">${esc(lead.status)}</span></td>
        <td class="muted">${dateFmt.format(new Date(lead.receivedAt))}</td>
      </tr>`,
    )
    .join('');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

refresh();
setInterval(refresh, 3000);
