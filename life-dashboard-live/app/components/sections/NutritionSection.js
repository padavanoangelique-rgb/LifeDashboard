'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SCHEMAS, MEAL_TYPE_OPTIONS } from '../../../lib/schemas';
import RecordModal from '../RecordModal';
import { todayDate, toISO, addDays, fromISO, fmtDate, mondayOfWeek } from '../../../lib/utils';

const LOG_SCHEMA = SCHEMAS.nutritionLogs;
const MEAL_SCHEMA = SCHEMAS.savedMeals;
const PLAN_SCHEMA = SCHEMAS.mealPlan;
const GROCERY_SCHEMA = SCHEMAS.groceryItems;
const GROCERY_CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Pantry', 'Frozen', 'Other'];

function isBalanced(m) {
  const cal = Number(m.calories) || 0;
  if (!cal) return false;
  const proteinPct = (Number(m.protein) || 0) * 4 / cal;
  const fatPct = (Number(m.fat) || 0) * 9 / cal;
  return proteinPct >= 0.2 && proteinPct <= 0.4 && fatPct <= 0.35;
}

export default function NutritionSection() {
  const [targets, setTargets] = useState(null);
  const [logs, setLogs] = useState([]);
  const [water, setWater] = useState([]);
  const [savedMeals, setSavedMeals] = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [grocery, setGrocery] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(() => toISO(todayDate()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [waterAmount, setWaterAmount] = useState('8');

  const [logModal, setLogModal] = useState(null);
  const [mealModal, setMealModal] = useState(null);
  const [planModal, setPlanModal] = useState(null); // { plan_date, meal_type } | record | null
  const [groceryModal, setGroceryModal] = useState(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetsForm, setTargetsForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, l, w, sm, mp, g] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('id', 1).single(),
      supabase.from('nutrition_logs').select('*'),
      supabase.from('water_logs').select('*'),
      supabase.from('saved_meals').select('*'),
      supabase.from('meal_plan').select('*'),
      supabase.from('grocery_items').select('*')
    ]);
    setTargets(t.data || { calories: 2000, protein: 150, carbs: 200, fat: 65, water_goal_oz: 64 });
    setLogs(l.data || []);
    setWater(w.data || []);
    setSavedMeals(sm.data || []);
    setMealPlan(mp.data || []);
    setGrocery(g.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !targets) return <div className="empty">Loading…</div>;

  const dayLogs = logs.filter(l => l.log_date === selectedDate);
  const dayTotals = dayLogs.reduce((acc, l) => ({
    calories: acc.calories + Number(l.calories || 0),
    protein: acc.protein + Number(l.protein || 0),
    carbs: acc.carbs + Number(l.carbs || 0),
    fat: acc.fat + Number(l.fat || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const dayWaterOz = water.filter(w => w.log_date === selectedDate).reduce((s, w) => s + Number(w.ounces || 0), 0);

  const macroMax = Math.max(1, targets.calories, dayTotals.calories);

  async function saveTargets(e) {
    e.preventDefault();
    const payload = {
      calories: Number(targetsForm.calories) || 0,
      protein: Number(targetsForm.protein) || 0,
      carbs: Number(targetsForm.carbs) || 0,
      fat: Number(targetsForm.fat) || 0,
      water_goal_oz: Number(targetsForm.water_goal_oz) || 0
    };
    const { data } = await supabase.from('nutrition_targets').update(payload).eq('id', 1).select().single();
    setTargets(data);
    setEditingTargets(false);
  }

  function handleLogSaved(row, { deleted }) {
    setLogs(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }
  function handleMealSaved(row, { deleted }) {
    setSavedMeals(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }
  function handlePlanSaved(row, { deleted }) {
    setMealPlan(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }
  function handleGrocerySaved(row, { deleted }) {
    setGrocery(list => (deleted ? list.filter(r => r.id !== row.id) : (list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [...list, row])));
  }

  async function logSavedMeal(m) {
    const { data } = await supabase.from('nutrition_logs').insert({
      log_date: selectedDate, meal_type: m.meal_type, name: m.name,
      calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat
    }).select().single();
    if (data) setLogs(list => [...list, data]);
  }

  async function addWater() {
    const oz = Number(waterAmount) || 0;
    if (!oz) return;
    const { data } = await supabase.from('water_logs').insert({ log_date: selectedDate, ounces: oz }).select().single();
    if (data) setWater(list => [...list, data]);
  }

  async function removePlanItem(id) {
    await supabase.from('meal_plan').delete().eq('id', id);
    setMealPlan(list => list.filter(r => r.id !== id));
  }

  async function toggleGrocery(item) {
    await supabase.from('grocery_items').update({ checked: !item.checked }).eq('id', item.id);
    setGrocery(list => list.map(g => (g.id === item.id ? { ...g, checked: !g.checked } : g)));
  }

  async function clearChecked() {
    const checkedIds = grocery.filter(g => g.checked).map(g => g.id);
    if (!checkedIds.length) return;
    await supabase.from('grocery_items').delete().in('id', checkedIds);
    setGrocery(list => list.filter(g => !g.checked));
  }

  const weekStart = addDays(mondayOfWeek(todayDate()), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)));

  async function addWeekToGroceryList() {
    const names = new Set();
    for (const dISO of weekDays) {
      for (const item of mealPlan.filter(p => p.plan_date === dISO)) {
        if (item.name) names.add(item.name.trim());
      }
    }
    const existing = new Set(grocery.map(g => g.item.trim().toLowerCase()));
    const toAdd = [...names].filter(n => !existing.has(n.toLowerCase())).map(n => ({ item: n, quantity: '', category: 'Other', checked: false }));
    if (!toAdd.length) return;
    const { data } = await supabase.from('grocery_items').insert(toAdd).select();
    if (data) setGrocery(list => [...list, ...data]);
  }

  const groceryByCategory = GROCERY_CATEGORIES.map(cat => ({ cat, items: grocery.filter(g => g.category === cat) })).filter(g => g.items.length);

  return (
    <>
      <section className="block">
        <h2>
          Daily Targets
          <span className="btn-row"><button className="small" onClick={() => { setTargetsForm(targets); setEditingTargets(true); }}>Edit targets</button></span>
        </h2>
        <div className="card chart-card">
          <div className="legend">
            <span className="item"><span className="swatch" style={{ background: 'var(--series-1)' }} />Target</span>
            <span className="item"><span className="swatch" style={{ background: 'var(--series-2)' }} />Today</span>
          </div>
          <div className="bars">
            {[
              ['Calories', dayTotals.calories, targets.calories],
              ['Protein', dayTotals.protein, targets.protein],
              ['Carbs', dayTotals.carbs, targets.carbs],
              ['Fat', dayTotals.fat, targets.fat]
            ].map(([label, val, target]) => {
              const max = Math.max(1, val, target);
              return (
                <div className="bar-group" key={label}>
                  <div className="bar-pair">
                    <div className="bar" style={{ height: `${(target / max) * 100}%`, background: 'var(--series-1)' }} />
                    <div className="bar" style={{ height: `${(val / max) * 100}%`, background: val > target ? 'var(--critical)' : 'var(--series-2)' }} />
                  </div>
                  <div className="bar-label">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="block">
        <h2>
          Meal Log
          <span className="btn-row">
            <button className="small" onClick={() => setSelectedDate(toISO(addDays(fromISO(selectedDate), -1)))}>‹ Prev day</button>
            <button className="small" onClick={() => setSelectedDate(toISO(todayDate()))}>Today</button>
            <button className="small" onClick={() => setSelectedDate(toISO(addDays(fromISO(selectedDate), 1)))}>Next day ›</button>
            <button className="small primary" onClick={() => setLogModal('add')}>+ Log food</button>
          </span>
        </h2>
        <div className="card">
          <div className="field-hint" style={{ marginTop: 0 }}>{fmtDate(selectedDate)} — {Math.round(dayTotals.calories)} cal logged</div>
          {dayLogs.length === 0 ? (
            <div className="empty">Nothing logged for this day yet.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Meal</th><th>Item</th><th className="num">Cal</th><th className="num">Protein</th><th className="num">Carbs</th><th className="num">Fat</th><th></th></tr></thead>
              <tbody>
                {dayLogs.map(l => (
                  <tr key={l.id}>
                    <td>{l.meal_type}</td>
                    <td>{l.name}</td>
                    <td className="num">{l.calories}</td>
                    <td className="num">{l.protein}</td>
                    <td className="num">{l.carbs}</td>
                    <td className="num">{l.fat}</td>
                    <td className="row-actions"><button className="small" onClick={() => setLogModal(l)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="block">
        <h2>Water Intake</h2>
        <div className="card">
          <div style={{ marginBottom: 10 }}>
            {Math.round(dayWaterOz)} / {targets.water_goal_oz} oz
            <div className="progress-track" style={{ marginTop: 6 }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (dayWaterOz / (targets.water_goal_oz || 1)) * 100)}%` }} />
            </div>
          </div>
          <div className="btn-row">
            <input type="number" value={waterAmount} onChange={e => setWaterAmount(e.target.value)} style={{ width: 80, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
            <button className="small primary" onClick={addWater}>+ Add oz</button>
            <button className="small" onClick={() => { setWaterAmount('8'); addWater(); }}>+8 oz</button>
          </div>
        </div>
      </section>

      <section className="block">
        <h2>
          Saved Meals
          <span className="btn-row"><button className="small primary" onClick={() => setMealModal('add')}>+ Save meal</button></span>
        </h2>
        {savedMeals.length === 0 ? (
          <div className="card empty">No saved meals yet.</div>
        ) : (
          <div className="grid stat-grid">
            {savedMeals.map(m => (
              <div className="card" key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <strong>{m.name}</strong>
                    <div className="field-hint" style={{ marginBottom: 0 }}>{m.meal_type} · {m.calories} cal</div>
                  </div>
                  {isBalanced(m) && <span className="pill good">Balanced macros</span>}
                </div>
                <div className="field-hint">P {m.protein}g · C {m.carbs}g · F {m.fat}g</div>
                <div className="btn-row">
                  <button className="small primary" onClick={() => logSavedMeal(m)}>+ Log for {fmtDate(selectedDate)}</button>
                  <button className="small" onClick={() => setMealModal(m)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <h2>
          Weekly Meal Planner
          <span className="btn-row">
            <button className="small" onClick={() => setWeekOffset(o => o - 1)}>‹ Prev week</button>
            <button className="small" onClick={() => setWeekOffset(0)}>This week</button>
            <button className="small" onClick={() => setWeekOffset(o => o + 1)}>Next week ›</button>
            <button className="small primary" onClick={addWeekToGroceryList}>+ Add week to grocery list</button>
          </span>
        </h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="plan-table">
            <thead>
              <tr>
                <th></th>
                {weekDays.map(d => <th key={d}>{fromISO(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</th>)}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPE_OPTIONS.map(mt => (
                <tr key={mt}>
                  <td className="plan-row-label">{mt}</td>
                  {weekDays.map(d => (
                    <td className="plan-cell" key={d}>
                      {mealPlan.filter(p => p.plan_date === d && p.meal_type === mt).map(item => (
                        <div className="plan-item" key={item.id}>
                          <span>{item.name}</span>
                          <span className="plan-item-actions">
                            <button onClick={() => removePlanItem(item.id)} title="Remove">✕</button>
                          </span>
                        </div>
                      ))}
                      <button className="plan-add" onClick={() => setPlanModal({ plan_date: d, meal_type: mt })}>+ Add</button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="block">
        <h2>
          Grocery List
          <span className="btn-row">
            <button className="small" onClick={clearChecked}>Clear checked</button>
            <button className="small primary" onClick={() => setGroceryModal('add')}>+ Add item</button>
          </span>
        </h2>
        {groceryByCategory.length === 0 ? (
          <div className="card empty">Grocery list is empty.</div>
        ) : (
          groceryByCategory.map(({ cat, items }) => (
            <div className="card" key={cat} style={{ marginBottom: 10 }}>
              <strong>{cat}</strong>
              <div style={{ marginTop: 8 }}>
                {items.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 14.5, textDecoration: g.checked ? 'line-through' : 'none', color: g.checked ? 'var(--text-muted)' : 'inherit' }}>
                    <input type="checkbox" checked={!!g.checked} onChange={() => toggleGrocery(g)} />
                    {g.item}{g.quantity ? ` — ${g.quantity}` : ''}
                    <button className="small" style={{ marginLeft: 'auto' }} onClick={() => setGroceryModal(g)}>Edit</button>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {logModal && (
        <RecordModal schema={LOG_SCHEMA} record={logModal === 'add' ? { log_date: selectedDate } : logModal} onClose={() => setLogModal(null)} onSaved={handleLogSaved} />
      )}
      {mealModal && (
        <RecordModal schema={MEAL_SCHEMA} record={mealModal === 'add' ? null : mealModal} onClose={() => setMealModal(null)} onSaved={handleMealSaved} />
      )}
      {planModal && (
        <RecordModal
          schema={PLAN_SCHEMA}
          record={planModal.id ? planModal : { plan_date: planModal.plan_date, meal_type: planModal.meal_type }}
          extra={planModal.id ? undefined : { plan_date: planModal.plan_date, meal_type: planModal.meal_type }}
          onClose={() => setPlanModal(null)}
          onSaved={handlePlanSaved}
        />
      )}
      {groceryModal && (
        <RecordModal schema={GROCERY_SCHEMA} record={groceryModal === 'add' ? null : groceryModal} onClose={() => setGroceryModal(null)} onSaved={handleGrocerySaved} />
      )}
      {editingTargets && targetsForm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditingTargets(false); }}>
          <div className="modal">
            <h3>Edit Daily Targets</h3>
            <form onSubmit={saveTargets}>
              {['calories', 'protein', 'carbs', 'fat', 'water_goal_oz'].map(k => (
                <div className="field" key={k}>
                  <label>{k === 'water_goal_oz' ? 'Water goal (oz)' : k[0].toUpperCase() + k.slice(1)}</label>
                  <input type="number" step="any" value={targetsForm[k]} onChange={e => setTargetsForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingTargets(false)}>Cancel</button>
                <button type="submit" className="primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
