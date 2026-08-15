'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Generic bulk-edit modal: apply one change to many rows at once (e.g. "bump
// every account balance", "mark every bill unpaid for the new month", "set
// every budget category's Spent back to 0"). Works against whatever rows are
// currently loaded/visible in the section — pass the filtered list in.
//
// Props: schema, rows (array of currently loaded records), onClose, onDone()
export default function BulkUpdateModal({ schema, rows, onClose, onDone }) {
  const editableFields = schema.fields.filter(f => ['number', 'boolean', 'select', 'text'].includes(f.type));
  const [fieldKey, setFieldKey] = useState(editableFields[0]?.key || '');
  const field = editableFields.find(f => f.key === fieldKey);
  const [mode, setMode] = useState('set'); // set | add | percent (number fields only)
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState(() => new Set(rows.map(r => r.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggleRow(id) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function computeNewValue(row) {
    if (field.type === 'number') {
      const current = Number(row[fieldKey]) || 0;
      const v = Number(value) || 0;
      if (mode === 'add') return current + v;
      if (mode === 'percent') return current * (1 + v / 100);
      return v;
    }
    if (field.type === 'boolean') return value === 'true';
    return value;
  }

  async function handleApply() {
    if (!field || !selected.size) return;
    setBusy(true);
    setError('');
    try {
      const targets = rows.filter(r => selected.has(r.id));
      for (const row of targets) {
        const newVal = computeNewValue(row);
        const { error } = await supabase.from(schema.table).update({ [fieldKey]: newVal }).eq('id', row.id);
        if (error) throw error;
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide">
        <h3>Bulk update — {schema.plural}</h3>

        <div className="field">
          <label>Field to change</label>
          <select value={fieldKey} onChange={e => setFieldKey(e.target.value)}>
            {editableFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>

        {field?.type === 'number' && (
          <div className="field">
            <label>How</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="set">Set every selected row to</option>
              <option value="add">Add this amount to every selected row</option>
              <option value="percent">Adjust every selected row by this percent</option>
            </select>
          </div>
        )}

        <div className="field">
          <label>{field?.type === 'number' && mode === 'percent' ? 'Percent (e.g. 5 or -10)' : 'New value'}</label>
          {field?.type === 'select' ? (
            <select value={value} onChange={e => setValue(e.target.value)}>
              <option value="">Select…</option>
              {field.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : field?.type === 'boolean' ? (
            <select value={value} onChange={e => setValue(e.target.value)}>
              <option value="">Select…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input type={field?.type === 'number' ? 'number' : 'text'} step="any" value={value} onChange={e => setValue(e.target.value)} />
          )}
        </div>

        <div className="field">
          <label>Apply to ({selected.size} of {rows.length} selected)</label>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            {rows.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 14 }}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                {r.name || r.title || r.client_name || r.job_number || r.item || r.id}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="primary" onClick={handleApply} disabled={busy || !selected.size || value === ''}>
            {busy ? 'Applying…' : `Apply to ${selected.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}
