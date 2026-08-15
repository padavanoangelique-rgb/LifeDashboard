'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import CsvImportModal from '../CsvImportModal';
import { fmtMoney } from '../../../lib/utils';

const SCHEMA = SCHEMAS.holdings;

function BuyModal({ holdings, onClose, onDone }) {
  const [ticker, setTicker] = useState('');
  const [broker, setBroker] = useState('');
  const [subAccount, setSubAccount] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const sharesBought = Number(shares) || 0;
    const pricePaid = Number(price) || 0;
    const t = ticker.trim().toUpperCase();
    const b = broker.trim();
    const sa = subAccount.trim();

    const existing = holdings.find(h =>
      h.ticker.trim().toUpperCase() === t &&
      h.broker.trim().toLowerCase() === b.toLowerCase() &&
      h.sub_account.trim().toLowerCase() === sa.toLowerCase()
    );

    let result;
    if (existing) {
      const totalShares = Number(existing.shares) + sharesBought;
      const totalCost = Number(existing.shares) * Number(existing.cost_basis) + sharesBought * pricePaid;
      const newCostBasis = totalShares ? totalCost / totalShares : pricePaid;
      result = await supabase.from('holdings').update({ shares: totalShares, cost_basis: newCostBasis }).eq('id', existing.id).select().single();
    } else {
      result = await supabase.from('holdings').insert({
        ticker: t, broker: b, sub_account: sa, shares: sharesBought, cost_basis: pricePaid, current_price: pricePaid
      }).select().single();
    }
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    onDone(result.data, { wasExisting: !!existing });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Log Purchase</h3>
        <p className="field-hint">If this ticker already exists in the same broker + account type, shares and cost basis merge with a weighted-average cost. Otherwise a new holding is created.</p>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Ticker</label><input type="text" value={ticker} onChange={e => setTicker(e.target.value)} required /></div>
          <div className="field"><label>Broker</label><input type="text" value={broker} onChange={e => setBroker(e.target.value)} required /></div>
          <div className="field"><label>Account type</label><input type="text" value={subAccount} onChange={e => setSubAccount(e.target.value)} required /></div>
          <div className="field"><label>Shares bought</label><input type="number" step="any" value={shares} onChange={e => setShares(e.target.value)} required /></div>
          <div className="field"><label>Price paid / share</label><input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} required /></div>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Log Purchase'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PortfolioSection() {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBrokers, setOpenBrokers] = useState(() => new Set());
  const [modal, setModal] = useState(null);
  const [showBuy, setShowBuy] = useState(false);
  const [showCsv, setShowCsv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('holdings').select('*').order('broker', { ascending: true });
    setHoldings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading…</div>;

  function toggleBroker(b) {
    setOpenBrokers(s => { const n = new Set(s); if (n.has(b)) n.delete(b); else n.add(b); return n; });
  }

  function handleSaved(row, { deleted }) {
    setHoldings(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }

  const totalValue = holdings.reduce((s, h) => s + Number(h.shares) * Number(h.current_price), 0);
  const totalCost = holdings.reduce((s, h) => s + Number(h.shares) * Number(h.cost_basis), 0);
  const totalGain = totalValue - totalCost;

  const byBroker = new Map();
  for (const h of holdings) {
    if (!byBroker.has(h.broker)) byBroker.set(h.broker, []);
    byBroker.get(h.broker).push(h);
  }
  const brokerGroups = [...byBroker.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat-tile">
          <div className="label">Market Value</div>
          <div className="value">{fmtMoney(totalValue)}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Cost Basis</div>
          <div className="value">{fmtMoney(totalCost)}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Gain / Loss</div>
          <div className="value">{fmtMoney(totalGain)}</div>
          <div className={`delta ${totalGain >= 0 ? 'up' : 'down'}`}>{totalCost ? ((totalGain / totalCost) * 100).toFixed(1) : '0.0'}%</div>
        </div>
      </div>

      <section className="block">
        <h2>
          Portfolio Holdings
          <span className="btn-row">
            <button className="small" onClick={() => setShowCsv(true)}>{SCHEMA.csv.buttonLabel}</button>
            <button className="small" onClick={() => setModal('add')}>+ Add Holding</button>
            <button className="small primary" onClick={() => setShowBuy(true)}>+ Log Purchase</button>
          </span>
        </h2>

        {brokerGroups.length === 0 ? <div className="card empty">No holdings yet. Add one, log a purchase, or upload a spreadsheet.</div> : (
          brokerGroups.map(([broker, items]) => {
            const open = openBrokers.has(broker);
            const value = items.reduce((s, h) => s + Number(h.shares) * Number(h.current_price), 0);
            return (
              <div className={`acct-accordion${open ? ' open' : ''}`} key={broker}>
                <button className="acct-summary" onClick={() => toggleBroker(broker)}>
                  <span className="acct-summary-name"><span className="acct-caret">▶</span><strong>{broker}</strong></span>
                  <span className="acct-summary-figures">{fmtMoney(value)}</span>
                </button>
                {open && (
                  <div className="acct-holdings">
                    <table className="data">
                      <thead><tr><th>Ticker</th><th>Account</th><th className="num">Shares</th><th className="num">Cost/sh</th><th className="num">Price/sh</th><th className="num">Value</th><th className="num">Gain/Loss</th><th></th></tr></thead>
                      <tbody>
                        {items.map(h => {
                          const value = Number(h.shares) * Number(h.current_price);
                          const cost = Number(h.shares) * Number(h.cost_basis);
                          const gain = value - cost;
                          return (
                            <tr key={h.id}>
                              <td><strong>{h.ticker}</strong></td>
                              <td>{h.sub_account}</td>
                              <td className="num">{h.shares}</td>
                              <td className="num">{fmtMoney(h.cost_basis)}</td>
                              <td className="num">{fmtMoney(h.current_price)}</td>
                              <td className="num">{fmtMoney(value)}</td>
                              <td className="num" style={{ color: gain >= 0 ? 'var(--good)' : 'var(--critical)' }}>{fmtMoney(gain)}</td>
                              <td className="row-actions"><button className="small" onClick={() => setModal(h)}>Edit</button></td>
                            </tr>
                          );
                        })}
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
      {showBuy && (
        <BuyModal holdings={holdings} onClose={() => setShowBuy(false)} onDone={() => load()} />
      )}
      {showCsv && (
        <CsvImportModal schema={SCHEMA} onClose={() => setShowCsv(false)} onImported={() => load()} />
      )}
    </>
  );
}
