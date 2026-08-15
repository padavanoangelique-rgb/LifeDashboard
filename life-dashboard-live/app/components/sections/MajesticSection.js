'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import { fmtDate, escapeHtml } from '../../../lib/utils';

const SCHEMA = SCHEMAS.majesticPermits;

function subStatusPill(sub) {
  const cls = sub === 'Complete' || sub === 'Approved and Printed' || sub === 'Approved'
    ? 'good'
    : sub === 'In Review' ? 'warning'
    : sub === 'Need to Submit' ? 'critical'
    : 'neutral';
  return <span className={`pill ${cls}`}>{sub || '—'}</span>;
}

export default function MajesticSection() {
  const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openClients, setOpenClients] = useState(() => new Set());
  const [modal, setModal] = useState(null);
  const [showCsv, setShowCsv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('majestic_permits').select('*').order('client_name', { ascending: true });
    setPermits(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(row, { deleted }) {
    setPermits(list => {
      if (deleted) return list.filter(r => r.id !== row.id);
      const exists = list.some(r => r.id === row.id);
      return exists ? list.map(r => (r.id === row.id ? row : r)) : [...list, row];
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter(p => `${p.client_name} ${p.job_number} ${p.permit_number}`.toLowerCase().includes(q));
  }, [permits, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of filtered) {
      const key = p.client_name || '(No client name)';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function toggleClient(name) {
    setOpenClients(s => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function printReport() {
    const rows = filtered.map(p => `
      <tr>
        <td>${escapeHtml(p.client_name)}</td>
        <td>${escapeHtml(p.job_number)}</td>
        <td>${escapeHtml(p.permit_number)}</td>
        <td>${escapeHtml(p.stage)}</td>
        <td>${escapeHtml(p.sub_status)}</td>
        <td>${p.due_date ? fmtDate(p.due_date) : ''}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><title>Majestic Permits Report</title><style>
      body{font-family:system-ui,sans-serif;color:#111;padding:24px;}
      h1{font-size:18px;margin:0 0 4px;} .sub{color:#666;font-size:13px;margin-bottom:18px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
      th{background:#f2f2f2;text-transform:uppercase;font-size:11px;letter-spacing:.03em;}
    </style></head><body>
      <h1>Majestic Permits Report</h1>
      <div class="sub">${filtered.length} permit${filtered.length === 1 ? '' : 's'} — generated ${new Date().toLocaleDateString()}</div>
      <table><thead><tr><th>Client / Job</th><th>Job #</th><th>Permit #</th><th>Stage</th><th>Sub-status</th><th>Due date</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <>
      <section className="block">
        <h2>
          Majestic Permits
          <span className="btn-row">
            <button className="small" onClick={printReport}>🖨 Print report</button>
            <button className="small" onClick={() => setShowCsv(true)}>{SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setModal('add')}>+ Add Permit</button>
          </span>
        </h2>
        <div className="toolbar">
          <input type="text" placeholder="Search client, job #, or permit #…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
          <span className="count">{filtered.length} permit{filtered.length === 1 ? '' : 's'} across {grouped.length} client{grouped.length === 1 ? '' : 's'}</span>
        </div>

        {grouped.length === 0 ? (
          <div className="card empty">No permits yet. Add one or upload a job list.</div>
        ) : (
          grouped.map(([client, list]) => {
            const open = openClients.has(client);
            const complete = list.filter(p => p.sub_status === 'Complete').length;
            return (
              <div className={`acct-accordion${open ? ' open' : ''}`} key={client}>
                <button className="acct-summary" onClick={() => toggleClient(client)}>
                  <span className="acct-summary-name">
                    <span className="acct-caret">▶</span>
                    <strong>{client}</strong>
                  </span>
                  <span className="acct-summary-figures">
                    <span className="pill neutral">{list.length} permit{list.length === 1 ? '' : 's'}</span>{' '}
                    <span className="pill good">{complete} complete</span>
                  </span>
                </button>
                {open && (
                  <div className="acct-holdings">
                    <table className="data">
                      <thead><tr><th>Job #</th><th>Permit #</th><th>Stage</th><th>Sub-status</th><th>Due date</th><th></th></tr></thead>
                      <tbody>
                        {list.map(p => (
                          <tr key={p.id}>
                            <td>{p.job_number}</td>
                            <td>{p.permit_number}</td>
                            <td>{p.stage}</td>
                            <td>{subStatusPill(p.sub_status)}</td>
                            <td>{p.due_date ? fmtDate(p.due_date) : '—'}</td>
                            <td className="row-actions"><button className="small" onClick={() => setModal(p)}>Edit</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {modal && (
        <RecordModal schema={SCHEMA} record={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {showCsv && (
        <CsvImportModal schema={SCHEMA} onClose={() => setShowCsv(false)} onImported={() => load()} />
      )}
    </>
  );
}
