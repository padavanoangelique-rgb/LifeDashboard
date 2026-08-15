// Shared date/money/formatting helpers used across every section component.

export function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(base, n) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

// Local (not UTC) YYYY-MM-DD — safe for storing as a Postgres `date`.
export function toISO(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromISO(s) {
  if (!s) return null;
  const [y, m, dd] = s.split('-').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd);
}

export function fmtDate(s) {
  const d = fromISO(s);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoney0(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function escapeHtml(s) {
  return String(s ?? '');
}

// ---------------------------------------------------------------------------
// CSV parsing (comma or tab delimited, quoted-field aware) — used by the
// generic CsvImportModal for every "Upload spreadsheet" button.
// ---------------------------------------------------------------------------
export function parseCSV(text) {
  const firstLine = text.split('\n')[0] || '';
  const delim = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export function normalizeHeaderToKey(h, columns) {
  const norm = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const col of columns) {
    for (const alias of col.aliases) {
      if (norm === alias.toLowerCase().replace(/[^a-z0-9]/g, '')) return col.key;
    }
  }
  for (const col of columns) {
    for (const alias of col.aliases) {
      const a = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (a && (norm.includes(a) || a.includes(norm))) return col.key;
    }
  }
  return null;
}

export function parseDateFlexible(s) {
  if (!s) return '';
  s = String(s).trim();
  if (!s) return '';
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/))) {
    let [, mo, da, yr] = m;
    if (yr.length === 2) yr = (Number(yr) < 50 ? '20' : '19') + yr;
    return `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return '';
}

export function parseBoolFlexible(s) {
  const v = String(s || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1'].includes(v);
}

export function uid() {
  // Only used for React `key` props on optimistic/local-only rows before a
  // server id exists — the database always assigns the real uuid.
  return Math.random().toString(36).slice(2, 10);
}
