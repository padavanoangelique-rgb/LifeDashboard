'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { parseCSV, normalizeHeaderToKey, parseDateFlexible, parseBoolFlexible } from '../../lib/utils';
import { csvColumns, columnAliases, emptyRecord, matchKeyOf } from '../../lib/schemas';

// Generic "⇪ Upload spreadsheet" modal driven by a schema object. Accepts a
// .csv file or pasted CSV/TSV text with a header row. Header matching is
// alias-flexible (see lib/utils.js normalizeHeaderToKey). Rows are matched
// to existing records by the schema's matchKey — a match updates the
// existing row in place, no match inserts a new row. Rows missing the
// primary (first) match-key value are skipped, not added blank.
//
// Props: schema, onClose, onImported(count)
export default function CsvImportModal({ schema, onClose, onImported }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { imported, skipped }

  const columns = csvColumns(schema);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file);
  }

  async function handleImport() {
    setError('');
    setResult(null);
    const rows = parseCSV(text);
    if (rows.length < 2) { setError('No data rows found. Include a header row plus at least one data row.'); return; }

    const header = rows[0];
    const dataRows = rows.slice(1);
    const lookupColumns = columns.map(c => ({ key: c.key, aliases: columnAliases(c) }));
    const headerKeys = header.map(h => normalizeHeaderToKey(h, lookupColumns));

    const parsed = [];
    let skipped = 0;
    for (const row of dataRows) {
      const rec = emptyRecord(schema);
      // Only fields with a matched CSV header get overwritten — the rest keep
      // sensible schema defaults for a brand-new row.
      headerKeys.forEach((key, idx) => {
        if (!key) return;
        const col = columns.find(c => c.key === key);
        if (!col) return;
        const raw = (row[idx] ?? '').trim();
        if (col.type === 'number') rec[key] = raw === '' ? 0 : Number(String(raw).replace(/[$,]/g, '')) || 0;
        else if (col.type === 'date') rec[key] = parseDateFlexible(raw);
        else if (col.type === 'boolean') rec[key] = parseBoolFlexible(raw);
        else rec[key] = raw;
      });
      const primaryKeyField = schema.matchKey[0];
      if (!String(rec[primaryKeyField] || '').trim()) { skipped++; continue; }
      parsed.push(rec);
    }

    if (!parsed.length) { setError('No rows had a value in the required match-key column.'); return; }

    setBusy(true);
    try {
      const { data: existing, error: fetchErr } = await supabase.from(schema.table).select(['id', ...schema.matchKey].join(','));
      if (fetchErr) throw fetchErr;
      const existingMap = new Map();
      for (const row of existing || []) existingMap.set(matchKeyOf(schema, row), row.id);

      const toInsert = [];
      const toUpdate = [];
      for (const rec of parsed) {
        const key = matchKeyOf(schema, rec);
        const id = existingMap.get(key);
        if (id) toUpdate.push({ id, rec });
        else toInsert.push(rec);
      }

      if (toInsert.length) {
        const { error: insErr } = await supabase.from(schema.table).insert(toInsert);
        if (insErr) throw insErr;
      }
      for (const u of toUpdate) {
        const { error: updErr } = await supabase.from(schema.table).update(u.rec).eq('id', u.id);
        if (updErr) throw updErr;
      }

      const imported = toInsert.length + toUpdate.length;
      setResult({ imported, skipped });
      onImported(imported);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide">
        <h3>{schema.csv.buttonLabel.replace('⇪ ', '')} — {schema.plural}</h3>
        <p className="field-hint">
          Upload a .csv file, or paste rows below. The header row can use common variations of the column
          names — matching rows update the existing record, new rows get added.
        </p>
        <div className="field">
          <label>CSV file</label>
          <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} />
          {fileName && <div className="field-hint" style={{ marginTop: 4 }}>Loaded: {fileName}</div>}
        </div>
        <div className="field">
          <label>Or paste data</label>
          <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder={columns.map(c => c.label).join(',')} />
        </div>
        {error && <p className="login-error">{error}</p>}
        {result && (
          <p style={{ color: 'var(--good)', fontSize: 14 }}>
            Imported {result.imported}{result.skipped ? `, skipped ${result.skipped} (missing match key)` : ''}.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>{result ? 'Done' : 'Cancel'}</button>
          <button type="button" className="primary" onClick={handleImport} disabled={busy || !text.trim()}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
