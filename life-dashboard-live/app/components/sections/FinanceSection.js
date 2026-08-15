'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import BulkUpdateModal from '../BulkUpdateModal';
import { fmtMoney } from '../../../lib/utils';

const ACCT_SCHEMA = SCHEMAS.accounts;
const BUDGET_SCHEMA = SCHEMAS.budgetCategories;
const DEBT_SCHEMA = SCHEMAS.debts;
const OWNERS = ['Personal', 'Business'];

export default function FinanceSection() {
  const [accounts, setAccounts] = useState([]);
  const [budget, setBudget] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openOwners, setOpenOwners] = useState(() => new Set(OWNERS));
  const [debtOrder, setDebtOrder] = useState('avalanche'); // avalanche = highest rate first, snowball = lowest balance first

  const [acctModal, setAcctModal] = useState(null);
  const [budgetModal, setBudgetModal] = useState(null);
  const [debtModal, setDebtModal] = useState(null);
  const [csvFor, setCsvFor] = useState(null); // 'accounts' | 'budget' | 'debts' | null
  const [bulkFor, setBulkFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, d] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('budget_categories').select('*'),
      supabase.from('debts').select('*')
    ]);
    setAccounts(a.data || []);
    setBudget(b.data || []);
    setDebts(d.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading…</div>;

  function toggleOwner(o) {
    setOpenOwners(s => { const n = new Set(s); if (n.has(o)) n.delete(o); else n.add(o); return n; });
  }

  const sortedDebts = [...debts].sort((a, b) => (
    debtOrder === 'avalanche' ? Number(b.interest_rate) - Number(a.interest_rate) : Number(a.current_balance) - Number(b.current_balance)
  ));
  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance || 0), 0);
  const totalOriginal = debts.reduce((s, d) => s + Number(d.original_balance || 0), 0);

  return (
    <>
      <section className="block">
        <h2>
          Accounts
          <span className="btn-row">
            <button className="small" onClick={() => setBulkFor('accounts')}>Bulk update</button>
            <button className="small" onClick={() => setCsvFor('accounts')}>{ACCT_SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setAcctModal('add')}>+ Add Account</button>
          </span>
        </h2>
        {accounts.length === 0 ? <div className="card empty">No accounts yet.</div> : (
          OWNERS.map(owner => {
            const items = accounts.filter(a => a.owner === owner);
            if (!items.length) return null;
            const sum = items.reduce((s, a) => s + Number(a.balance || 0), 0);
            const open = openOwners.has(owner);
            return (
              <div className={`acct-accordion${open ? ' open' : ''}`} key={owner}>
                <button className="acct-summary" onClick={() => toggleOwner(owner)}>
                  <span className="acct-summary-name"><span className="acct-caret">▶</span><strong>{owner}</strong></span>
                  <span className="acct-summary-figures">{fmtMoney(sum)}</span>
                </button>
                {open && (
                  <div className="acct-holdings">
                    <table className="data">
                      <thead><tr><th>Name</th><th>Type</th><th className="num">Balance</th><th></th></tr></thead>
                      <tbody>
                        {items.map(a => (
                          <tr key={a.id}>
                            <td>{a.name}</td>
                            <td>{a.type}</td>
                            <td className="num">{fmtMoney(a.balance)}</td>
                            <td className="row-actions"><button className="small" onClick={() => setAcctModal(a)}>Edit</button></td>
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

      <section className="block">
        <h2>
          Monthly Budget
          <span className="btn-row">
            <button className="small" onClick={() => setBulkFor('budget')}>Bulk update</button>
            <button className="small" onClick={() => setCsvFor('budget')}>{BUDGET_SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setBudgetModal('add')}>+ Add Category</button>
          </span>
        </h2>
        <div className="card">
          {budget.length === 0 ? <div className="empty">No budget categories yet.</div> : (
            <table className="data">
              <thead><tr><th>Category</th><th className="num">Budgeted</th><th className="num">Spent</th><th className="num">Remaining</th><th></th></tr></thead>
              <tbody>
                {budget.map(c => {
                  const remaining = Number(c.budgeted) - Number(c.spent);
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="num">{fmtMoney(c.budgeted)}</td>
                      <td className="num">{fmtMoney(c.spent)}</td>
                      <td className="num">{remaining < 0 ? <span className="pill critical">{fmtMoney(remaining)}</span> : fmtMoney(remaining)}</td>
                      <td className="row-actions"><button className="small" onClick={() => setBudgetModal(c)}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="num">{fmtMoney(budget.reduce((s, c) => s + Number(c.budgeted || 0), 0))}</th>
                  <th className="num">{fmtMoney(budget.reduce((s, c) => s + Number(c.spent || 0), 0))}</th>
                  <th className="num">{fmtMoney(budget.reduce((s, c) => s + (Number(c.budgeted || 0) - Number(c.spent || 0)), 0))}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      <section className="block">
        <h2>
          Debt Payoff
          <span className="btn-row">
            <button className={`small${debtOrder === 'avalanche' ? ' active' : ''}`} onClick={() => setDebtOrder('avalanche')} title="Highest interest rate first">Avalanche</button>
            <button className={`small${debtOrder === 'snowball' ? ' active' : ''}`} onClick={() => setDebtOrder('snowball')} title="Lowest balance first">Snowball</button>
            <button className="small" onClick={() => setBulkFor('debts')}>Bulk update</button>
            <button className="small" onClick={() => setCsvFor('debts')}>{DEBT_SCHEMA.csv.buttonLabel}</button>
            <button className="small primary" onClick={() => setDebtModal('add')}>+ Add Debt</button>
          </span>
        </h2>
        {debts.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="label" style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total remaining</div>
            <div className="value" style={{ fontSize: 26 }}>{fmtMoney(totalDebt)}</div>
            <div className="progress-track" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${totalOriginal ? Math.min(100, ((totalOriginal - totalDebt) / totalOriginal) * 100) : 0}%` }} />
            </div>
          </div>
        )}
        {sortedDebts.length === 0 ? <div className="card empty">No debts tracked — nice, or add one to plan payoff.</div> : (
          sortedDebts.map(d => {
            const paidPct = d.original_balance ? Math.min(100, ((Number(d.original_balance) - Number(d.current_balance)) / Number(d.original_balance)) * 100) : 0;
            return (
              <div className="card" key={d.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{d.name}</strong>
                  <span className="pill neutral">{d.type}</span>
                </div>
                <div className="field-hint">
                  {fmtMoney(d.current_balance)} remaining of {fmtMoney(d.original_balance)} · {d.interest_rate}% APR · min {fmtMoney(d.minimum_payment)}/mo
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${paidPct}%` }} /></div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="small" onClick={() => setDebtModal(d)}>Edit</button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {acctModal && <RecordModal schema={ACCT_SCHEMA} record={acctModal === 'add' ? null : acctModal} onClose={() => setAcctModal(null)} onSaved={(row, meta) => setAccounts(list => (meta.deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])))} />}
      {budgetModal && <RecordModal schema={BUDGET_SCHEMA} record={budgetModal === 'add' ? null : budgetModal} onClose={() => setBudgetModal(null)} onSaved={(row, meta) => setBudget(list => (meta.deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])))} />}
      {debtModal && <RecordModal schema={DEBT_SCHEMA} record={debtModal === 'add' ? null : debtModal} onClose={() => setDebtModal(null)} onSaved={(row, meta) => setDebts(list => (meta.deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])))} />}

      {csvFor === 'accounts' && <CsvImportModal schema={ACCT_SCHEMA} onClose={() => setCsvFor(null)} onImported={() => load()} />}
      {csvFor === 'budget' && <CsvImportModal schema={BUDGET_SCHEMA} onClose={() => setCsvFor(null)} onImported={() => load()} />}
      {csvFor === 'debts' && <CsvImportModal schema={DEBT_SCHEMA} onClose={() => setCsvFor(null)} onImported={() => load()} />}

      {bulkFor === 'accounts' && <BulkUpdateModal schema={ACCT_SCHEMA} rows={accounts} onClose={() => setBulkFor(null)} onDone={() => load()} />}
      {bulkFor === 'budget' && <BulkUpdateModal schema={BUDGET_SCHEMA} rows={budget} onClose={() => setBulkFor(null)} onDone={() => load()} />}
      {bulkFor === 'debts' && <BulkUpdateModal schema={DEBT_SCHEMA} rows={debts} onClose={() => setBulkFor(null)} onDone={() => load()} />}
    </>
  );
}
