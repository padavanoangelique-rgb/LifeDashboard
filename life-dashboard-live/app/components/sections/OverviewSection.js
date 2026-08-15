'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import { fmtMoney, fmtMoney0, fmtDate, todayDate, fromISO, daysBetween } from '../../../lib/utils';

const APPT_SCHEMA = SCHEMAS.appointments;

function daysUntil(dateStr) {
  const d = fromISO(dateStr);
  if (!d) return null;
  return daysBetween(todayDate(), d);
}

function urgencyPill(days) {
  if (days === null) return <span className="pill neutral">Undated</span>;
  if (days < 0) return <span className="pill critical">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="pill critical">Today</span>;
  if (days <= 2) return <span className="pill serious">In {days}d</span>;
  if (days <= 7) return <span className="pill warning">In {days}d</span>;
  return <span className="pill good">In {days}d</span>;
}

export default function OverviewSection({ onNavigate }) {
  const [accounts, setAccounts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [budget, setBudget] = useState([]);
  const [bills, setBills] = useState([]);
  const [appts, setAppts] = useState([]);
  const [majestic, setMajestic] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | record object
  const [showCsv, setShowCsv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, d, b, bi, ap, mp] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('debts').select('*'),
      supabase.from('budget_categories').select('*'),
      supabase.from('bills').select('*'),
      supabase.from('appointments').select('*'),
      supabase.from('majestic_permits').select('*')
    ]);
    setAccounts(a.data || []);
    setDebts(d.data || []);
    setBudget(b.data || []);
    setBills(bi.data || []);
    setAppts(ap.data || []);
    setMajestic(mp.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading…</div>;

  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance || 0), 0);
  const netWorth = totalAssets - totalDebt;
  const totalBudgeted = budget.reduce((s, c) => s + Number(c.budgeted || 0), 0);
  const totalSpent = budget.reduce((s, c) => s + Number(c.spent || 0), 0);

  const attentionBills = bills
    .filter(b => !b.paid && b.due_date)
    .map(b => ({ kind: 'Bill', label: b.name, days: daysUntil(b.due_date), sub: fmtMoney(b.amount) }))
    .filter(b => b.days !== null && b.days <= 7);

  const attentionAppts = appts
    .filter(a => !a.done)
    .map(a => ({ kind: a.type || 'To-do', label: a.title, days: a.appt_date ? daysUntil(a.appt_date) : null, sub: a.appt_time || '' }))
    .filter(a => a.days === null || a.days <= 7);

  const attentionPermits = majestic
    .filter(p => p.due_date && p.stage !== 'Complete')
    .map(p => ({ kind: 'Permit', label: `${p.client_name || p.job_number}`, days: daysUntil(p.due_date), sub: p.stage }))
    .filter(p => p.days !== null && p.days <= 7);

  const attention = [...attentionBills, ...attentionAppts, ...attentionPermits]
    .sort((x, y) => (x.days ?? 999) - (y.days ?? 999));

  const maxBudget = Math.max(1, ...budget.map(c => Math.max(Number(c.budgeted) || 0, Number(c.spent) || 0)));

  async function toggleApptDone(a) {
    await supabase.from('appointments').update({ done: !a.done }).eq('id', a.id);
    load();
  }

  function handleSaved(row, { deleted }) {
    setAppts(list => {
      if (deleted) return list.filter(r => r.id !== row.id);
      const exists = list.some(r => r.id === row.id);
      return exists ? list.map(r => (r.id === row.id ? row : r)) : [...list, row];
    });
  }

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat-tile">
          <div className="label">Net Worth</div>
          <div className="value">{fmtMoney0(netWorth)}</div>
          <div className="delta flat">Assets {fmtMoney0(totalAssets)} − Debt {fmtMoney0(totalDebt)}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Monthly Budget</div>
          <div className="value">{fmtMoney0(totalSpent)} / {fmtMoney0(totalBudgeted)}</div>
          <div className={`delta ${totalBudgeted - totalSpent >= 0 ? 'up' : 'down'}`}>
            {fmtMoney0(Math.abs(totalBudgeted - totalSpent))} {totalBudgeted - totalSpent >= 0 ? 'remaining' : 'over'}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="label">Unpaid Bills</div>
          <div className="value">{bills.filter(b => !b.paid).length}</div>
          <div className="delta flat">{fmtMoney0(bills.filter(b => !b.paid).reduce((s, b) => s + Number(b.amount || 0), 0))} due</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Open To-dos</div>
          <div className="value">{appts.filter(a => !a.done).length}</div>
          <div className="delta flat">{attention.length} need attention this week</div>
        </div>
      </div>

      <section className="block">
        <h2>Needs attention</h2>
        <div className="card">
          {attention.length === 0 ? (
            <div className="empty">Nothing urgent — nice.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>When</th></tr></thead>
              <tbody>
                {attention.map((item, i) => (
                  <tr key={i}>
                    <td>{item.kind}</td>
                    <td>{item.label}</td>
                    <td>{item.sub}</td>
                    <td>{urgencyPill(item.days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {budget.length > 0 && (
        <section className="block">
          <h2>Budget: Budgeted vs. Spent</h2>
          <div className="card chart-card">
            <div className="legend">
              <span className="item"><span className="swatch" style={{ background: 'var(--series-1)' }} />Budgeted</span>
              <span className="item"><span className="swatch" style={{ background: 'var(--series-2)' }} />Spent</span>
            </div>
            <div className="bars">
              {budget.map(c => {
                const over = Number(c.spent) > Number(c.budgeted);
                return (
                  <div className="bar-group" key={c.id}>
                    <div className="bar-pair">
                      <div className="bar" style={{ height: `${(Number(c.budgeted) / maxBudget) * 100}%`, background: 'var(--series-1)' }} />
                      <div className="bar" style={{ height: `${(Number(c.spent) / maxBudget) * 100}%`, background: over ? 'var(--critical)' : 'var(--series-2)' }} />
                    </div>
                    <div className="bar-label">{c.name}</div>
                    {over && <div className="over-flag">over</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="block">
        <h2>
          Appointments &amp; To-dos
          <span className="btn-row">
            <button className="small" onClick={() => setShowCsv(true)}>{APPT_SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setModal('add')}>+ Add</button>
          </span>
        </h2>
        <div className="card">
          {appts.length === 0 ? (
            <div className="empty">No appointments or to-dos yet.</div>
          ) : (
            <table className="data">
              <thead><tr><th></th><th>Title</th><th>Type</th><th>Date</th><th>Time</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {[...appts].sort((a, b) => (daysUntil(a.appt_date) ?? 999) - (daysUntil(b.appt_date) ?? 999)).map(a => (
                  <tr key={a.id} style={a.done ? { opacity: 0.5 } : undefined}>
                    <td><input type="checkbox" checked={!!a.done} onChange={() => toggleApptDone(a)} /></td>
                    <td>{a.title}</td>
                    <td>{a.type}</td>
                    <td>{a.appt_date ? fmtDate(a.appt_date) : '—'}</td>
                    <td>{a.appt_time}</td>
                    <td>{a.notes}</td>
                    <td className="row-actions"><button className="small" onClick={() => setModal(a)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {modal && (
        <RecordModal
          schema={APPT_SCHEMA}
          record={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {showCsv && (
        <CsvImportModal schema={APPT_SCHEMA} onClose={() => setShowCsv(false)} onImported={() => load()} />
      )}
    </>
  );
}
