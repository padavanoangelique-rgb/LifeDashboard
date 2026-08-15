-- My Life Dashboard — full schema
-- Run this in the Supabase SQL Editor: Project -> SQL Editor -> New query -> paste -> Run.
-- This is an internal single-user (or small trusted household) tool: RLS is
-- "any authenticated user can read/write everything" — there is no per-row
-- ownership model. Add one, some, per staff member via Authentication > Users.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Guardian Permits (day job) — simple date tracking
-- ---------------------------------------------------------------------------
create table if not exists guardian_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_number text not null default '',
  client_name text not null default '',
  date_assigned date,
  date_submitted date,
  date_approved date,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Majestic Permits (side gig) — full stage-board tracking
-- ---------------------------------------------------------------------------
create table if not exists majestic_permits (
  id uuid primary key default uuid_generate_v4(),
  client_name text not null default '',
  job_number text not null default '',
  permit_number text not null default '',
  stage text not null default 'Need Permit Submittal',
  sub_status text not null default 'Need to Submit',
  due_date date,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Personal Goals + milestones
-- ---------------------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  title text not null default '',
  category text not null default 'Personal',
  start_date date,
  target_date date,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists goal_milestones (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references goals(id) on delete cascade,
  text text not null default '',
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Finance: accounts, budget, debts
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  owner text not null default 'Personal',       -- Personal | Business
  type text not null default 'Checking',         -- Checking | Savings | Credit Card | Loan | Cash
  balance numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists budget_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  budgeted numeric not null default 0,
  spent numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists debts (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  type text not null default 'Credit Card',
  original_balance numeric not null default 0,
  current_balance numeric not null default 0,
  interest_rate numeric not null default 0,
  minimum_payment numeric not null default 0,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------
create table if not exists bills (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  amount numeric not null default 0,
  category text not null default 'Other',        -- Utilities | Credit Card | Subscriptions | Other
  due_date date,
  recurrence text not null default 'Monthly',     -- One-time | Weekly | Monthly | Quarterly | Yearly
  autopay boolean not null default false,
  paid boolean not null default false,
  reminder_days int not null default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Portfolio holdings
-- ---------------------------------------------------------------------------
create table if not exists holdings (
  id uuid primary key default uuid_generate_v4(),
  ticker text not null default '',
  broker text not null default '',
  sub_account text not null default '',
  shares numeric not null default 0,
  cost_basis numeric not null default 0,          -- avg price paid, per share
  current_price numeric not null default 0,       -- refreshed by the daily cron
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists idx_holdings_identity on holdings (lower(ticker), lower(broker), lower(sub_account));

-- ---------------------------------------------------------------------------
-- Nutrition: targets (singleton row), logs, saved meals, water, meal plan
-- ---------------------------------------------------------------------------
create table if not exists nutrition_targets (
  id int primary key default 1,
  calories numeric not null default 2000,
  protein numeric not null default 150,
  carbs numeric not null default 200,
  fat numeric not null default 65,
  water_goal_oz numeric not null default 64,
  constraint nutrition_targets_singleton check (id = 1)
);
insert into nutrition_targets (id) values (1) on conflict (id) do nothing;

create table if not exists nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  log_date date not null default current_date,
  meal_type text not null default 'Snack',        -- Breakfast | Lunch | Dinner | Snack
  name text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists saved_meals (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  meal_type text not null default 'Snack',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists water_logs (
  id uuid primary key default uuid_generate_v4(),
  log_date date not null default current_date,
  ounces numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists meal_plan (
  id uuid primary key default uuid_generate_v4(),
  plan_date date not null,
  meal_type text not null default 'Dinner',
  name text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists grocery_items (
  id uuid primary key default uuid_generate_v4(),
  item text not null default '',
  quantity text not null default '',
  category text not null default 'Other',         -- Produce | Protein | Dairy | Pantry | Frozen | Other
  checked boolean not null default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Appointments & to-dos
-- ---------------------------------------------------------------------------
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  title text not null default '',
  type text not null default 'To-do',             -- Appointment | To-do
  appt_date date,
  appt_time text not null default '',
  notes text not null default '',
  done boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Time blocking — color-coded blocks on the dashboard's weekly time-block
-- grid, optionally tied to a Personal Goal.
-- ---------------------------------------------------------------------------
create table if not exists time_blocks (
  id uuid primary key default uuid_generate_v4(),
  block_date date not null default current_date,
  start_time text not null default '09:00',       -- 24h "HH:MM"
  end_time text not null default '10:00',          -- 24h "HH:MM"
  label text not null default '',
  color text not null default '#2a78d6',           -- hex color for the block
  goal_id uuid references goals(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (only tables that carry an updated_at column)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['guardian_jobs','majestic_permits','goals','accounts',
    'budget_categories','debts','bills','holdings','appointments','time_blocks']
  loop
    execute format('drop trigger if exists trg_%s_updated on %I;', t, t);
    execute format('create trigger trg_%s_updated before update on %I for each row execute procedure set_updated_at();', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security — any authenticated user, full access, every table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['guardian_jobs','majestic_permits','goals','goal_milestones',
    'accounts','budget_categories','debts','bills','holdings','nutrition_targets',
    'nutrition_logs','saved_meals','water_logs','meal_plan','grocery_items','appointments',
    'time_blocks']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "authenticated all" on %I;', t);
    execute format('create policy "authenticated all" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_guardian_jobs_number on guardian_jobs (job_number);
create index if not exists idx_majestic_client on majestic_permits (client_name);
create index if not exists idx_majestic_jobnum on majestic_permits (job_number);
create index if not exists idx_bills_due on bills (due_date);
create index if not exists idx_nutrition_logs_date on nutrition_logs (log_date);
create index if not exists idx_water_logs_date on water_logs (log_date);
create index if not exists idx_meal_plan_date on meal_plan (plan_date);
create index if not exists idx_appointments_date on appointments (appt_date);
create index if not exists idx_goal_milestones_goal on goal_milestones (goal_id);
create index if not exists idx_time_blocks_date on time_blocks (block_date);
create index if not exists idx_time_blocks_goal on time_blocks (goal_id);

-- ---------------------------------------------------------------------------
-- To add a column later, run a small ALTER as its own snippet, e.g.:
--   ALTER TABLE bills ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
-- If Supabase reports "Could not find the column in the schema cache" right
-- after running an ALTER successfully, double-check you're in the same
-- Supabase project whose URL/key are set in Vercel (project mismatch is the
-- most common cause, not an actual cache problem).
