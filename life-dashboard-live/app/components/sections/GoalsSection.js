'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import { fmtDate, todayDate, fromISO } from '../../../lib/utils';

const GOAL_SCHEMA = SCHEMAS.goals;

function deriveStatus(goal, milestones) {
  const total = milestones.length;
  const done = milestones.filter(m => m.done).length;
  if (total > 0 && done === total) return { label: 'Complete', cls: 'good' };
  const today = todayDate();
  const target = goal.target_date ? fromISO(goal.target_date) : null;
  if (target && target < today) return { label: 'Overdue', cls: 'critical' };
  const start = goal.start_date ? fromISO(goal.start_date) : null;
  if (done > 0 || (start && start <= today)) return { label: 'In Progress', cls: 'warning' };
  return { label: 'Not Started', cls: 'neutral' };
}

function MilestoneEditor({ goalId, milestones, onChange }) {
  const [text, setText] = useState('');
  const items = milestones.filter(m => m.goal_id === goalId).sort((a, b) => a.sort_order - b.sort_order);

  async function addMilestone(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const sortOrder = items.length ? Math.max(...items.map(m => m.sort_order)) + 1 : 0;
    const { data } = await supabase.from('goal_milestones').insert({ goal_id: goalId, text: text.trim(), done: false, sort_order: sortOrder }).select().single();
    if (data) onChange([...milestones, data]);
    setText('');
  }

  async function toggle(m) {
    await supabase.from('goal_milestones').update({ done: !m.done }).eq('id', m.id);
    onChange(milestones.map(x => (x.id === m.id ? { ...x, done: !x.done } : x)));
  }

  async function remove(m) {
    await supabase.from('goal_milestones').delete().eq('id', m.id);
    onChange(milestones.filter(x => x.id !== m.id));
  }

  return (
    <div>
      <div className="milestone-list">
        {items.map(m => (
          <div className="milestone-row" key={m.id} onClick={() => toggle(m)}>
            <input type="checkbox" checked={!!m.done} readOnly />
            <span className={m.done ? 'done' : ''}>{m.text}</span>
            <button className="small" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); remove(m); }}>✕</button>
          </div>
        ))}
        {items.length === 0 && <div className="field-hint" style={{ marginTop: 0 }}>No milestones yet.</div>}
      </div>
      <form onSubmit={addMilestone} className="milestone-edit-row" style={{ marginTop: 8 }}>
        <input className="m-text" type="text" placeholder="Add a milestone…" value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" className="small primary">Add</button>
      </form>
    </div>
  );
}

export default function GoalsSection() {
  const [goals, setGoals] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, m] = await Promise.all([
      supabase.from('goals').select('*'),
      supabase.from('goal_milestones').select('*')
    ]);
    setGoals(g.data || []);
    setMilestones(m.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading…</div>;

  function handleSaved(row, { deleted }) {
    setGoals(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
    if (deleted) setMilestones(list => list.filter(m => m.goal_id !== row.id));
  }

  return (
    <>
      <section className="block">
        <h2>
          Personal Goals
          <span className="btn-row"><button className="small primary" onClick={() => setModal('add')}>+ Add Goal</button></span>
        </h2>

        {goals.length === 0 ? <div className="card empty">No goals yet — add one to start tracking milestones.</div> : (
          <div className="grid stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            {goals.map(g => {
              const goalMilestones = milestones.filter(m => m.goal_id === g.id);
              const total = goalMilestones.length;
              const done = goalMilestones.filter(m => m.done).length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const status = deriveStatus(g, goalMilestones);
              return (
                <div className="card" key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>{g.title}</strong>
                      <div className="field-hint" style={{ marginBottom: 0 }}>
                        {g.category}{g.target_date ? ` · due ${fmtDate(g.target_date)}` : ''}
                      </div>
                    </div>
                    <span className={`pill ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="progress-track" style={{ marginTop: 10 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                  <div className="field-hint">{done}/{total} milestones ({pct}%)</div>
                  {g.notes && <div className="field-hint">{g.notes}</div>}
                  <MilestoneEditor goalId={g.id} milestones={milestones} onChange={setMilestones} />
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="small" onClick={() => setModal(g)}>Edit Goal</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modal && (
        <RecordModal schema={GOAL_SCHEMA} record={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </>
  );
}
