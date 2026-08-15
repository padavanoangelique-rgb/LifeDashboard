'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import { fmtMoney, fmtMoney0, fmtDate, todayDate, fromISO, daysBetween, mondayOfWeek, addDays, toISO } from '../../../lib/utils';

const APPT_SCHEMA = SCHEMAS.appointments;
const BLOCK_SCHEMA = SCHEMAS.timeBlocks;

const DAY_START_HOUR = 6;   // 6am
const DAY_END_HOUR = 22;    // 10pm
const GRID_HEIGHT = 640;    // px, for the time-blocking week grid
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const PX_PER_MIN = GRID_HEIGHT / TOTAL_MINUTES;

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

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function weekDaysFrom(offset) {
  const start = addDays(mondayOfWeek(todayDate()), offset * 7);
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));
}

export default function OverviewSection({ onNavigate }) {
  const [accounts, setAccounts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [budget, setBudget] = useState([]);
  const [bills, setBills] = useState([]);
  const [appts, setAppts] = useState([]);
  const [majestic, setMajestic] = useState([]);
  const [goals, setGoals] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null); // appointment modal: 'add' | record object
  const [showCsv, setShowCsv] = useState(false);
  const [apptView, setApptView] = useState('list'); // list | week
  const [apptWeekOffset, setApptWeekOffset] = useState(0);

  const [blockWeekOffset, setBlockWeekOffset] = useState(0);
  const [blockModal, setBlockModal] = useState(null); // 'add' | record | { block_date } (prefilled add)

  const load = useCallback(async () => {
    setLoading(true);
    const [a, d, b, bi, ap, mp, g, tb] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('debts').select('*'),
      supabase.from('budget_categories').select('*'),
      supabase.from('bills').select('*'),
      supabase.from('appointments').select('*'),
      supabase.from('majestic_permits').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('time_blocks').select('*')
    ]);
    setAccounts(a.data || []);
    setDebts(d.data || []);
    setBudget(b.data || []);
    setBills(bi.data || []);
    setAppts(ap.data || []);
    setMajestic(mp.data || []);
    setGoals(g.data || []);
    setBlocks(tb.data || []);
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

  function handleApptSaved(row, { deleted }) {
    setAppts(list => {
      if (deleted) return list.filter(r => r.id !== row.id);
      const exists = list.some(r => r.id === row.id);
      return exists ? list.map(r => (r.id === row.id ? row : r)) : [...list, row];
    });
  }

  function handleBlockSaved(row, { deleted }) {
    setBlocks(list => {
      if (deleted) return list.filter(r => r.id !== row.id);
      const exists = list.some(r => r.id === row.id);
      return exists ? list.map(r => (r.id === row.id ? row : r)) : [...list, row];
    });
  }

  const apptWeekDays = weekDaysFrom(apptWeekOffset);
  const blockWeekDays = weekDaysFrom(blockWeekOffset);
  const goalOptions = [{ value: '', label: '— No goal —' }, ...goals.map(g => ({ value: g.id, label: g.title }))];
  const goalTitleById = new Map(goals.map(g => [g.id, g.title]));
  const hourLabels = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

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

      <section className="block">
        <h2>
          Time Blocking
          <span className="btn-row">
            <button className="small" onClick={() => setBlockWeekOffset(o => o - 1)}>‹ Prev</button>
            <button className="small" onClick={() => setBlockWeekOffset(0)}>This week</button>
            <button className="small" onClick={() => setBlockWeekOffset(o => o + 1)}>Next ›</button>
            <button className="small primary" onClick={() => setBlockModal('add')}>+ Add Time Block</button>
          </span>
        </h2>
        <div className="card">
          {goals.length === 0 && (
            <div className="field-hint" style={{ marginTop: 0 }}>
              Tip: add a Personal Goal first if you want blocks linked to a goal — you can still add unlinked blocks without one.
            </div>
          )}
          <div style={{ display: 'flex', overflowX: 'auto' }}>
            <div style={{ flexShrink: 0, width: 52 }}>
              <div style={{ height: 24 }} />
              {hourLabels.map(h => (
                <div key={h} style={{ height: GRID_HEIGHT / hourLabels.length, fontSize: 11, color: 'var(--text-muted)', position: 'relative', top: -6 }}>
                  {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'am' : 'pm'}
                </div>
              ))}
            </div>
            {blockWeekDays.map(dISO => {
              const dayBlocks = blocks.filter(b => b.block_date === dISO);
              const isToday = dISO === toISO(todayDate());
              return (
                <div key={dISO} style={{ flex: '1 0 120px', minWidth: 120, marginRight: 4 }}>
                  <div style={{ height: 24, fontSize: 12, fontWeight: 600, textAlign: 'center', color: isToday ? 'var(--series-1)' : 'var(--text-secondary)' }}>
                    {fromISO(dISO).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </div>
                  <div
                    style={{
                      position: 'relative', height: GRID_HEIGHT, borderRadius: 6,
                      border: isToday ? '1px solid var(--series-1)' : '1px solid var(--gridline)',
                      background: `repeating-linear-gradient(to bottom, var(--gridline) 0, var(--gridline) 1px, transparent 1px, transparent ${GRID_HEIGHT / hourLabels.length}px)`
                    }}
                  >
                    {dayBlocks.map(b => {
                      const startMin = Math.min(TOTAL_MINUTES, Math.max(0, timeToMinutes(b.start_time) - DAY_START_HOUR * 60));
                      const endMin = Math.min(TOTAL_MINUTES, Math.max(startMin + 15, timeToMinutes(b.end_time) - DAY_START_HOUR * 60));
                      const top = startMin * PX_PER_MIN;
                      const height = Math.max(18, (endMin - startMin) * PX_PER_MIN);
                      return (
                        <button
                          key={b.id}
                          onClick={() => setBlockModal(b)}
                          title={`${b.label} (${b.start_time}–${b.end_time})${b.goal_id ? ' · ' + (goalTitleById.get(b.goal_id) || '') : ''}`}
                          style={{
                            position: 'absolute', top, height, left: 2, right: 2,
                            background: b.color, color: '#fff', border: 'none', borderRadius: 5,
                            padding: '2px 5px', fontSize: 11, textAlign: 'left', overflow: 'hidden', cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</div>
                          {height > 30 && <div style={{ opacity: 0.9 }}>{b.start_time}–{b.end_time}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
            <div className="toggle-row btn-row">
              <button className={`small${apptView === 'list' ? ' active' : ''}`} onClick={() => setApptView('list')}>List</button>
              <button className={`small${apptView === 'week' ? ' active' : ''}`} onClick={() => setApptView('week')}>Week</button>
            </div>
            <button className="small" onClick={() => setShowCsv(true)}>{APPT_SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setModal('add')}>+ Add</button>
          </span>
        </h2>

        {apptView === 'list' ? (
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
        ) : (
          <div className="card">
            <div className="toolbar">
              <div className="btn-row">
                <button className="small" onClick={() => setApptWeekOffset(o => o - 1)}>‹ Prev week</button>
                <button className="small" onClick={() => setApptWeekOffset(0)}>This week</button>
                <button className="small" onClick={() => setApptWeekOffset(o => o + 1)}>Next week ›</button>
              </div>
            </div>
            <div className="cal-grid">
              {apptWeekDays.map(d => (
                <div className="cal-head" key={`h-${d}`}>{fromISO(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>
              ))}
              {apptWeekDays.map(dISO => (
                <div className={`cal-cell${dISO === toISO(todayDate()) ? ' cal-today' : ''}`} key={dISO}>
                  <div className="cal-bills">
                    {appts.filter(a => a.appt_date === dISO).map(a => (
                      <button
                        key={a.id}
                        className={`cal-bill-chip pill ${a.done ? 'good' : a.type === 'Appointment' ? 'warning' : 'neutral'}`}
                        onClick={() => setModal(a)}
                      >
                        {a.appt_time ? `${a.appt_time} ` : ''}{a.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {modal && (
        <RecordModal
          schema={APPT_SCHEMA}
          record={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleApptSaved}
        />
      )}
      {showCsv && (
        <CsvImportModal schema={APPT_SCHEMA} onClose={() => setShowCsv(false)} onImported={() => load()} />
      )}
      {blockModal && (
        <RecordModal
          schema={BLOCK_SCHEMA}
          record={blockModal === 'add' ? null : blockModal}
          onClose={() => setBlockModal(null)}
          onSaved={handleBlockSaved}
          dynamicOptions={{ goal_id: goalOptions }}
        />
      )}
    </>
  );
}
