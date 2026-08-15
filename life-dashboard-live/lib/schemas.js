// ---------------------------------------------------------------------------
// Single source of truth for every entity's fields. Drives the generic
// <RecordModal> (add/edit form), <CsvImportModal> (header-flexible CSV
// upload), and <BulkUpdateModal> (multi-row quick edit).
//
// Field shape:
//   { key, label, type, options?, aliases?, step? }
// - type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean'
// - options: required for type 'select' — array of strings
// - aliases: ONLY set on fields that participate in CSV import. Their
//   presence is what marks a field as a CSV column (see csvColumns below).
//   The field's own label is automatically also treated as an alias.
// - step: optional input[type=number] step (defaults to 'any')
//
// matchKey: ordered array of field keys used both as the CSV de-dupe key
// and, for CsvImportModal, to find an existing row to update in place.
// The FIRST key in the array must be non-empty for a CSV row to import.
// ---------------------------------------------------------------------------

export const STAGE_OPTIONS = [
  'Need Permit Submittal', 'Needs Permit/HOA Submittal', 'Needs HOA Submittal',
  'RF Pending Permit', 'Awaiting HOA', 'In Review', 'Ready to Order', 'Ordered',
  'Awaiting Parts', 'Product Arrived - Needs Permit', 'Partial Product Arrived',
  'Product Arrived', 'RF Ready for Install', 'Scheduled for Install',
  'Install Started', 'In Progress', 'Needs Final Inspection',
  'Scheduled Final Inspection', 'Inspected', 'Pending Change Order Windows',
  'Open Service', 'Sales Manager Escalation'
];

export const SUB_STATUS_OPTIONS = [
  'Need to Submit', 'In Review', 'Approved', 'Approved and Printed', 'Complete'
];

export const MEAL_TYPE_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export const SCHEMAS = {
  guardianJobs: {
    table: 'guardian_jobs',
    singular: 'Job',
    plural: 'Guardian Permits',
    matchKey: ['job_number'],
    csv: { enabled: true, buttonLabel: '⇪ Upload data sheet' },
    fields: [
      { key: 'job_number', label: 'Job #', type: 'text', aliases: ['job#', 'jobnumber', 'job', 'jobno'] },
      { key: 'client_name', label: 'Name', type: 'text', aliases: ['name', 'clientname', 'client'] },
      { key: 'date_assigned', label: 'Date assigned', type: 'date', aliases: ['dateassigned', 'assigned', 'assigneddate'] },
      { key: 'date_submitted', label: 'Date submitted', type: 'date', aliases: ['datesubmitted', 'submitted', 'submitteddate'] },
      { key: 'date_approved', label: 'Date approved', type: 'date', aliases: ['dateapproved', 'approved', 'approveddate'] },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },

  majesticPermits: {
    table: 'majestic_permits',
    singular: 'Permit',
    plural: 'Majestic Permits',
    matchKey: ['job_number'],
    csv: { enabled: true, buttonLabel: '⇪ Upload job list' },
    fields: [
      { key: 'job_number', label: 'Job #', type: 'text', aliases: ['job#', 'jobnumber', 'job', 'jobno'] },
      { key: 'client_name', label: 'Client / job name', type: 'text', aliases: ['clientname', 'client', 'name'] },
      { key: 'permit_number', label: 'Permit #', type: 'text', aliases: ['permitnumber', 'permit#', 'permit'] },
      { key: 'stage', label: 'Stage', type: 'select', options: STAGE_OPTIONS, aliases: ['stage'] },
      { key: 'sub_status', label: 'Sub-status', type: 'select', options: SUB_STATUS_OPTIONS, aliases: ['substatus', 'status'] },
      { key: 'due_date', label: 'Due date', type: 'date', aliases: ['duedate', 'due'] },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },

  goals: {
    table: 'goals',
    singular: 'Goal',
    plural: 'Personal Goals',
    matchKey: ['title'],
    csv: { enabled: false },
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Personal', 'Financial', 'Health', 'Career', 'Home', 'Other'] },
      { key: 'start_date', label: 'Start date', type: 'date' },
      { key: 'target_date', label: 'Target date', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },

  goalMilestones: {
    table: 'goal_milestones',
    singular: 'Milestone',
    plural: 'Milestones',
    matchKey: ['text'],
    csv: { enabled: false },
    fields: [
      { key: 'text', label: 'Milestone', type: 'text' },
      { key: 'done', label: 'Done', type: 'boolean' },
      { key: 'sort_order', label: 'Sort order', type: 'number', step: '1' }
    ]
  },

  accounts: {
    table: 'accounts',
    singular: 'Account',
    plural: 'Accounts',
    matchKey: ['name'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'name', label: 'Account name', type: 'text', aliases: ['name', 'accountname', 'account'] },
      { key: 'owner', label: 'Owner', type: 'select', options: ['Personal', 'Business'], aliases: ['owner'] },
      { key: 'type', label: 'Type', type: 'select', options: ['Checking', 'Savings', 'Credit Card', 'Loan', 'Cash'], aliases: ['type', 'accounttype'] },
      { key: 'balance', label: 'Balance', type: 'number', aliases: ['balance', 'amount'] }
    ]
  },

  budgetCategories: {
    table: 'budget_categories',
    singular: 'Category',
    plural: 'Monthly Budget',
    matchKey: ['name'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'name', label: 'Category', type: 'text', aliases: ['name', 'category'] },
      { key: 'budgeted', label: 'Budgeted', type: 'number', aliases: ['budgeted', 'budget'] },
      { key: 'spent', label: 'Spent', type: 'number', aliases: ['spent', 'actual'] }
    ]
  },

  debts: {
    table: 'debts',
    singular: 'Debt',
    plural: 'Debt Payoff',
    matchKey: ['name'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'name', label: 'Debt name', type: 'text', aliases: ['name', 'debt'] },
      { key: 'type', label: 'Type', type: 'select', options: ['Credit Card', 'Student Loan', 'Auto Loan', 'Personal Loan', 'Mortgage', 'Other'], aliases: ['type'] },
      { key: 'original_balance', label: 'Original balance', type: 'number', aliases: ['originalbalance', 'original'] },
      { key: 'current_balance', label: 'Current balance', type: 'number', aliases: ['currentbalance', 'balance', 'current'] },
      { key: 'interest_rate', label: 'Interest rate (%)', type: 'number', aliases: ['interestrate', 'apr', 'rate'] },
      { key: 'minimum_payment', label: 'Minimum payment', type: 'number', aliases: ['minimumpayment', 'minpayment', 'minimum'] },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },

  bills: {
    table: 'bills',
    singular: 'Bill',
    plural: 'Bills',
    matchKey: ['name'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'name', label: 'Bill name', type: 'text', aliases: ['name', 'bill'] },
      { key: 'amount', label: 'Amount', type: 'number', aliases: ['amount'] },
      { key: 'category', label: 'Category', type: 'select', options: ['Utilities', 'Credit Card', 'Subscriptions', 'Other'], aliases: ['category'] },
      { key: 'due_date', label: 'Due date', type: 'date', aliases: ['duedate', 'due'] },
      { key: 'recurrence', label: 'Recurrence', type: 'select', options: ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'], aliases: ['recurrence', 'recurring', 'frequency'] },
      { key: 'autopay', label: 'Autopay', type: 'boolean', aliases: ['autopay'] },
      { key: 'paid', label: 'Paid', type: 'boolean', aliases: ['paid'] },
      { key: 'reminder_days', label: 'Remind days before', type: 'number', step: '1', aliases: ['reminderdays', 'remind'] }
    ]
  },

  holdings: {
    table: 'holdings',
    singular: 'Holding',
    plural: 'Portfolio Holdings',
    matchKey: ['ticker', 'broker', 'sub_account'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'ticker', label: 'Ticker', type: 'text', aliases: ['ticker', 'symbol'] },
      { key: 'broker', label: 'Broker', type: 'text', aliases: ['broker', 'institution'] },
      { key: 'sub_account', label: 'Account type', type: 'text', aliases: ['subaccount', 'account', 'accounttype'] },
      { key: 'shares', label: 'Shares', type: 'number', aliases: ['shares', 'quantity', 'qty'] },
      { key: 'cost_basis', label: 'Cost basis / share', type: 'number', aliases: ['costbasis', 'cost', 'avgcost'] },
      { key: 'current_price', label: 'Current price / share', type: 'number', aliases: ['currentprice', 'price'] }
    ]
  },

  nutritionTargets: {
    table: 'nutrition_targets',
    singular: 'Targets',
    plural: 'Nutrition Targets',
    matchKey: ['id'],
    csv: { enabled: false },
    fields: [
      { key: 'calories', label: 'Calories', type: 'number', step: '1' },
      { key: 'protein', label: 'Protein (g)', type: 'number', step: '1' },
      { key: 'carbs', label: 'Carbs (g)', type: 'number', step: '1' },
      { key: 'fat', label: 'Fat (g)', type: 'number', step: '1' },
      { key: 'water_goal_oz', label: 'Water goal (oz)', type: 'number', step: '1' }
    ]
  },

  nutritionLogs: {
    table: 'nutrition_logs',
    singular: 'Meal log entry',
    plural: 'Nutrition Log',
    matchKey: ['log_date', 'name'],
    csv: { enabled: false },
    fields: [
      { key: 'log_date', label: 'Date', type: 'date' },
      { key: 'meal_type', label: 'Meal', type: 'select', options: MEAL_TYPE_OPTIONS },
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'calories', label: 'Calories', type: 'number', step: '1' },
      { key: 'protein', label: 'Protein (g)', type: 'number' },
      { key: 'carbs', label: 'Carbs (g)', type: 'number' },
      { key: 'fat', label: 'Fat (g)', type: 'number' }
    ]
  },

  savedMeals: {
    table: 'saved_meals',
    singular: 'Saved meal',
    plural: 'Saved Meals',
    matchKey: ['name'],
    csv: { enabled: false },
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'meal_type', label: 'Meal', type: 'select', options: MEAL_TYPE_OPTIONS },
      { key: 'calories', label: 'Calories', type: 'number', step: '1' },
      { key: 'protein', label: 'Protein (g)', type: 'number' },
      { key: 'carbs', label: 'Carbs (g)', type: 'number' },
      { key: 'fat', label: 'Fat (g)', type: 'number' }
    ]
  },

  waterLogs: {
    table: 'water_logs',
    singular: 'Water entry',
    plural: 'Water Intake',
    matchKey: ['log_date'],
    csv: { enabled: false },
    fields: [
      { key: 'log_date', label: 'Date', type: 'date' },
      { key: 'ounces', label: 'Ounces', type: 'number' }
    ]
  },

  mealPlan: {
    table: 'meal_plan',
    singular: 'Planned meal',
    plural: 'Meal Planner',
    matchKey: ['plan_date', 'meal_type', 'name'],
    csv: { enabled: false },
    fields: [
      { key: 'plan_date', label: 'Date', type: 'date' },
      { key: 'meal_type', label: 'Meal', type: 'select', options: MEAL_TYPE_OPTIONS },
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'calories', label: 'Calories', type: 'number', step: '1' },
      { key: 'protein', label: 'Protein (g)', type: 'number' },
      { key: 'carbs', label: 'Carbs (g)', type: 'number' },
      { key: 'fat', label: 'Fat (g)', type: 'number' }
    ]
  },

  groceryItems: {
    table: 'grocery_items',
    singular: 'Grocery item',
    plural: 'Grocery List',
    matchKey: ['item', 'category'],
    csv: { enabled: false },
    fields: [
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Produce', 'Protein', 'Dairy', 'Pantry', 'Frozen', 'Other'] },
      { key: 'checked', label: 'Checked', type: 'boolean' }
    ]
  },

  appointments: {
    table: 'appointments',
    singular: 'Appointment / to-do',
    plural: 'Appointments & To-dos',
    matchKey: ['title', 'appt_date'],
    csv: { enabled: true, buttonLabel: '⇪ Upload spreadsheet' },
    fields: [
      { key: 'title', label: 'Title', type: 'text', aliases: ['title', 'item', 'name'] },
      { key: 'type', label: 'Type', type: 'select', options: ['Appointment', 'To-do'], aliases: ['type'] },
      { key: 'appt_date', label: 'Date', type: 'date', aliases: ['date'] },
      { key: 'appt_time', label: 'Time', type: 'text', aliases: ['time'] },
      { key: 'notes', label: 'Notes', type: 'textarea', aliases: ['notes'] },
      { key: 'done', label: 'Done', type: 'boolean', aliases: ['done', 'completed'] }
    ]
  },

  timeBlocks: {
    table: 'time_blocks',
    singular: 'Time Block',
    plural: 'Time Blocking',
    matchKey: ['block_date', 'start_time', 'label'],
    csv: { enabled: false },
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'block_date', label: 'Date', type: 'date' },
      { key: 'start_time', label: 'Start time', type: 'time' },
      { key: 'end_time', label: 'End time', type: 'time' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'goal_id', label: 'Linked goal (optional)', type: 'select', options: [], nullable: true }
    ]
  }
};

// Preset swatches offered in the color picker for time blocks (and anywhere
// else a color field shows up). Feel free to add more — any hex works.
export const TIME_BLOCK_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#c8508a', '#7a5cff', '#0ca30c', '#d03b3b'
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function defaultForField(field) {
  switch (field.type) {
    case 'number': return 0;
    case 'boolean': return false;
    case 'select': return field.nullable ? '' : (field.options?.[0] ?? '');
    case 'date': return '';
    case 'time': return '09:00';
    case 'color': return TIME_BLOCK_COLORS[0];
    default: return '';
  }
}

export function emptyRecord(schema) {
  const rec = {};
  for (const f of schema.fields) rec[f.key] = defaultForField(f);
  return rec;
}

// Fields that participate in CSV import (those with an `aliases` array).
export function csvColumns(schema) {
  return schema.fields.filter(f => Array.isArray(f.aliases));
}

// Every alias a column should be recognized by, including its own label.
export function columnAliases(field) {
  return [field.label, field.key, ...(field.aliases || [])];
}

export function matchKeyOf(schema, obj) {
  return schema.matchKey.map(k => String(obj?.[k] ?? '').trim().toLowerCase()).join('|');
}
