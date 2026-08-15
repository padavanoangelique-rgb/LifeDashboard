'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import BulkUpdateModal from '../BulkUpdateModal';
import { fmtMoney, fmtDate, todayDate, fromISO, addDays, addMonths, toISO } from '../../../lib/utils';

const SCHEMA = SCHEMAS.bills;
const CATEGORIES = ['Utilities', 'Credit Card', 'Subscriptions', 'Other'];
const FREQ_DAYS = { Weekly: 7, Biweekly: 14 };

function nextPaycheckDates(anchorISO, freq, count) {
  const dates = [];
  if (freq === 'Semi-monthly') {
    let d = fromISO(anchorISO) || todayDate();
    let cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    while (dates.length < count) {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const mid = new Date(cursor.getFullYear(), cursor.getMonth(), 16);
      if (first >= (fromISO(anchorISO) || todayDate())) dates.push(toISO(first));
      if (dates.length < count && mid >= (fromISO(anchorISO) || todayDate())) dates.push(toISO(mid));
      cursor = addMonths(cursor, 1);
    }
    return dates.slice(0, count);
  }
  if (freq === 'Monthly') {
    let d = fromISO(anchorISO) || todayDate();
    for (let i = 0; i < count; i++) dates.push(toISO(addMonths(d, i)));
    return dates;
  }
  const step = FREQ_DAYS[freq] || 14;
  let d = fromISO(anchorISO) || todayDate();
  for (let i = 0; i < count; i++) dates.push(toISO(addDays(d, i * step)));
  return dates;
}

export default function BillsSection() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | calendar | paycheck
  const [modal, setModal] = useState(null);
  const [showCsv, setShowCsv] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [monthDate, setMonthDate] = useState(() => { const d = todayDate(); d.setDate(1); return d; });
  const [paycheckAnchor, setPaycheckAnchor] = useState(() => toISO(todayDate()));
  const [paycheckFreq, setPaycheckFreq] = useState('Biweekly');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('bills').select('*').order('due_date', { ascending: true, nullsFirst: false });
    setBills(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(row, { deleted }) {
    setBills(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }

  async function togglePaid(b) {
    await supabase.from('bills').update({ paid: !b.paid }).eq('id', b.id);
    setBills(list => list.map(r => (r.id === b.id ? { ...r, paid: !r.paid } : r)));
  }

  if (loading) return <div className="empty">Loading…</div>;

  const grouped = CATEGORIES.map(cat => ({ cat, items: bills.filter(b => b.category === cat) })).filter(g => g.items.length);

  // ---- calendar view ----
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const leadBlanks = firstOfMonth.getDay();
  const todayISO = toISO(todayDate());
  const paydaysThisMonth = new Set(
    nextPaycheckDates(paycheckAnchor, paycheckFreq, 36).filter(d => {
      const dd = fromISO(d);
      return dd && dd.getMonth() === monthDate.getMonth() && dd.getFullYear() === monthDate.getFullYear();
    })
  );
  const calCells = [];
  for (let i = 0; i < leadBlanks; i++) calCells.push(null);
  for (let day = 1; day <= daysInMonth; day++) calCells.push(toISO(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)));

  // ---- paycheck view ----
  const upcomingPaydays = nextPaycheckDates(paycheckAnchor, paycheckFreq, 5);
  const periods = upcomingPaydays.map((start, i) => {
    const end = upcomingPaydays[i + 1] || toISO(addDays(fromISO(start), FREQ_DAYS[paycheckFreq] || 30));
    const items = bills.filter(b => b.due_date && b.due_date >= start && b.due_date < end);
    return { start, end, items, total: items.reduce((s, b) => s + Number(b.amount || 0), 0) };
  });

  return (
    <>
      <section className="block">
        <h2>
          Bills
          <span className="btn-row">
            <button className="small" onClick={() => setShowBulk(true)}>Bulk update</button>
            <button className="small" onClick={() => setShowCsv(true)}>{SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setModal('add')}>+ Add Bill</button>
          </span>
        </h2>

        <div className="toolbar">
          <div className="toggle-row btn-row">
            <button className={`small${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>List</button>
            <button className={`small${view === 'calendar' ? ' active' : ''}`} onClick={() => setView('calendar')}>Calendar</button>
            <button className={`small${view === 'paycheck' ? ' active' : ''}`} onClick={() => setView('paycheck')}>By paycheck</button>
          </div>
          <span className="count">{bills.filter(b => !b.paid).length} unpaid of {bills.length}</span>
        </div>

        {view === 'list' && (
          grouped.length === 0 ? <div className="card empty">No bills yet. Add one or upload a spreadsheet.</div> : (
            grouped.map(({ cat, items }) => (
              <div className="card" key={cat} style={{ marginBottom: 10 }}>
                <strong>{cat}</strong>
                <table className="data" style={{ marginTop: 8 }}>
                  <thead><tr><th></th><th>Name</th><th className="num">Amount</th><th>Due date</th><th>Recurrence</th><th>Autopay</th><th></th></tr></thead>
                  <tbody>
                    {items.map(b => (
                      <tr key={b.id} style={b.paid ? { opacity: 0.5 } : undefined}>
                        <td><input type="checkbox" checked={!!b.paid} onChange={() => togglePaid(b)} title="Paid" /></td>
                        <td>{b.name}</td>
                        <td className="num">{fmtMoney(b.amount)}</td>
                        <td>{b.due_date ? fmtDate(b.due_date) : '—'}</td>
                        <td>{b.recurrence}</td>
                        <td>{b.autopay ? <span className="pill good">Autopay</span> : <span className="pill neutral">Manual</span>}</td>
                        <td className="row-actions"><button className="small" onClick={() => setModal(b)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )
        )}

        {view === 'calendar' && (
          <div className="card">
            <div className="toolbar">
              <div className="btn-row">
                <button className="small" onClick={() => setMonthDate(d => { const n = addMonths(d, -1); n.setDate(1); return n; })}>‹ Prev</button>
                <button className="small" onClick={() => { const d = todayDate(); d.setDate(1); setMonthDate(d); }}>Today</button>
                <button className="small" onClick={() => setMonthDate(d => { const n = addMonths(d, 1); n.setDate(1); return n; })}>Next ›</button>
              </div>
              <strong>{monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            </div>
            <div className="cal-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div className="cal-head" key={d}>{d}</div>)}
              {calCells.map((dISO, i) => (
                <div className={`cal-cell${!dISO ? ' cal-empty' : ''}${dISO === todayISO ? ' cal-today' : ''}`} key={i}>
                  {dISO && (
                    <>
                      <div className="cal-daynum">
                        {fromISO(dISO).getDate()}
                        {paydaysThisMonth.has(dISO) && <span className="cal-payday">Payday</span>}
                      </div>
                      <div className="cal-bills">
                        {bills.filter(b => b.due_date === dISO).map(b => (
                          <button key={b.id} className={`cal-bill-chip pill ${b.paid ? 'good' : 'warning'}`} onClick={() => setModal(b)}>
                            {b.name} {fmtMoney(b.amount)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'paycheck' && (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="btn-row" style={{ alignItems: 'center' }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>Next/last payday</label>
                <input type="date" value={paycheckAnchor} onChange={e => setPaycheckAnchor(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }} />
                <label style={{ fontSize: 14, fontWeight: 600 }}>Frequency</label>
                <select value={paycheckFreq} onChange={e => setPaycheckFreq(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}>
                  <option>Weekly</option><option>Biweekly</option><option>Semi-monthly</option><option>Monthly</option>
                </select>
              </div>
              <div className="field-hint" style={{ marginBottom: 0 }}>This schedule is just for grouping bills below — it isn't saved anywhere.</div>
            </div>
            <div className="grid stat-grid">
              {periods.map((p, i) => (
                <div className="card" key={i}>
                  <div className="label" style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {fmtDate(p.start)} – {fmtDate(toISO(addDays(fromISO(p.end), -1)))}
                  </div>
                  <div className="value" style={{ fontSize: 22 }}>{fmtMoney(p.total)}</div>
                  {p.items.length === 0 ? <div className="field-hint">No bills due</div> : (
                    <div style={{ marginTop: 8 }}>
                      {p.items.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0' }}>
                          <span>{b.name}</span><span>{fmtMoney(b.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {modal && (
        <RecordModal schema={SCHEMA} record={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {showCsv && <CsvImportModal schema={SCHEMA} onClose={() => setShowCsv(false)} onImported={() => load()} />}
      {showBulk && <BulkUpdateModal schema={SCHEMA} rows={bills} onClose={() => setShowBulk(false)} onDone={() => load()} />}
    </>
  );
}
