'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { emptyRecord } from '../../lib/schemas';

// Generic add/edit form modal driven entirely by a schema object from
// lib/schemas.js. Handles insert, update, and delete against Supabase.
//
// Props:
//   schema    — an entry from SCHEMAS (see lib/schemas.js)
//   record    — existing row to edit, or null/undefined to create a new one
//   onClose   — called with no args to dismiss without saving
//   onSaved   — called with (row, { deleted }) after a successful save/delete
//   extra     — optional object of extra fixed fields merged into every save
//               (e.g. { goal_id } when adding a milestone under a goal)
//   wide      — render the larger modal width
export default function RecordModal({ schema, record, onClose, onSaved, extra, wide }) {
  const [form, setForm] = useState(() => (record ? { ...emptyRecord(schema), ...record } : emptyRecord(schema)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!record?.id;

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {};
    for (const f of schema.fields) {
      let v = form[f.key];
      if (f.type === 'number') v = v === '' || v === null || v === undefined ? 0 : Number(v);
      if (f.type === 'date' && !v) v = null;
      payload[f.key] = v;
    }
    Object.assign(payload, extra || {});

    let result;
    if (isEdit) {
      result = await supabase.from(schema.table).update(payload).eq('id', record.id).select().single();
    } else {
      result = await supabase.from(schema.table).insert(payload).select().single();
    }
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    onSaved(result.data, { deleted: false });
    onClose();
  }

  async function handleDelete() {
    if (!confirm(`Delete this ${schema.singular.toLowerCase()}? This can't be undone.`)) return;
    setSaving(true);
    setError('');
    const { error } = await supabase.from(schema.table).delete().eq('id', record.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved(record, { deleted: true });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <h3>{isEdit ? `Edit ${schema.singular}` : `Add ${schema.singular}`}</h3>
        <form onSubmit={handleSubmit}>
          {schema.fields.map(f => (
            <div className={f.type === 'boolean' ? 'field checkbox' : 'field'} key={f.key}>
              {f.type === 'boolean' ? (
                <>
                  <input
                    type="checkbox"
                    id={`f-${f.key}`}
                    checked={!!form[f.key]}
                    onChange={e => setField(f.key, e.target.checked)}
                  />
                  <label htmlFor={`f-${f.key}`}>{f.label}</label>
                </>
              ) : (
                <>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={form[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)} />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      step={f.type === 'number' ? (f.step || 'any') : undefined}
                      value={form[f.key] ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            {isEdit && <button type="button" className="danger" onClick={handleDelete} disabled={saving} style={{ marginRight: 'auto' }}>Delete</button>}
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
