'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import { fmtDate, fromISO, mondayOfWeek, addDays, toISO } from '../../../lib/utils';

const SCHEMA = SCHEMAS.guardianJobs;

function weekLabel(mondayISO) {
  const start = fromISO(mondayISO);
  const end = addDays(start, 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function GuardianSection() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [showCsv, setShowCsv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('guardian_jobs').select('*').order('date_assigned', { ascending: false, nullsFirst: false });
    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(row, { deleted }) {
    setJobs(list => {
      if (deleted) return list.filter(r => r.id !== row.id);
      const exists = list.some(r => r.id === row.id);
      return exists ? list.map(r => (r.id === row.id ? row : r)) : [row, ...list];
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(j => `${j.job_number} ${j.client_name} ${j.notes}`.toLowerCase().includes(q));
  }, [jobs, search]);

  const weeklyReport = useMemo(() => {
    const weeks = new Map(); // mondayISO -> {assigned, submitted, approved}
    function bump(dateStr, field) {
      if (!dateStr) return;
      const d = fromISO(dateStr);
      if (!d) return;
      const key = toISO(mondayOfWeek(d));
      if (!weeks.has(key)) weeks.set(key, { assigned: 0, submitted: 0, approved: 0 });
      weeks.get(key)[field]++;
    }
    for (const j of jobs) {
      bump(j.date_assigned, 'assigned');
      bump(j.date_submitted, 'submitted');
      bump(j.date_approved, 'approved');
    }
    return [...weeks.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 8);
  }, [jobs]);

  const monthlyTotals = useMemo(() => {
    const months = new Map(); // YYYY-MM -> {assigned, submitted, approved}
    function bump(dateStr, field) {
      if (!dateStr) return;
      const key = dateStr.slice(0, 7);
      if (!months.has(key)) months.set(key, { assigned: 0, submitted: 0, approved: 0 });
      months.get(key)[field]++;
    }
    for (const j of jobs) {
      bump(j.date_assigned, 'assigned');
      bump(j.date_submitted, 'submitted');
      bump(j.date_approved, 'approved');
    }
    return [...months.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [jobs]);

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <>
      <section className="block">
        <h2>Weekly Report</h2>
        {weeklyReport.length === 0 ? (
          <div className="card empty">No dated jobs yet.</div>
        ) : (
          <div className="grid stat-grid">
            {weeklyReport.map(([weekKey, counts]) => (
              <div className="card stat-tile" key={weekKey}>
                <div className="label">{weekLabel(weekKey)}</div>
                <div className="value" style={{ fontSize: 18 }}>
                  {counts.assigned} assigned · {counts.submitted} submitted · {counts.approved} approved
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <h2>Monthly Totals</h2>
        <div className="card">
          {monthlyTotals.length === 0 ? (
            <div className="empty">No dated jobs yet.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Month</th><th className="num">Assigned</th><th className="num">Submitted</th><th className="num">Approved</th></tr></thead>
              <tbody>
                {monthlyTotals.map(([key, c]) => (
                  <tr key={key}>
                    <td>{monthLabel(key)}</td>
                    <td className="num">{c.assigned}</td>
                    <td className="num">{c.submitted}</td>
                    <td className="num">{c.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="block">
        <h2>
          All Jobs
          <span className="btn-row">
            <button className="small" onClick={() => setShowCsv(true)}>{SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setModal('add')}>+ Add Job</button>
          </span>
        </h2>
        <div className="toolbar">
          <input type="text" placeholder="Search job # or name…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
          <span className="count">{filtered.length} job{filtered.length === 1 ? '' : 's'}</span>
        </div>
        <div className="card">
          {filtered.length === 0 ? (
            <div className="empty">No jobs yet. Add one or upload a spreadsheet.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Job #</th><th>Name</th><th>Assigned</th><th>Submitted</th><th>Approved</th><th></th></tr></thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id}>
                    <td>{j.job_number}</td>
                    <td>{j.client_name}</td>
                    <td>{j.date_assigned ? fmtDate(j.date_assigned) : '—'}</td>
                    <td>{j.date_submitted ? fmtDate(j.date_submitted) : '—'}</td>
                    <td>{j.date_approved ? <span className="pill good">{fmtDate(j.date_approved)}</span> : '—'}</td>
                    <td className="row-actions"><button className="small" onClick={() => setModal(j)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
