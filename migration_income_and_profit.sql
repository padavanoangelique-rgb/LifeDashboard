-- Adds Income tracking (Finance page) and Revenue/Job Cost/Profit on
-- Majestic Permits, to a database that already has the rest of the schema
-- applied. If you haven't deployed yet, you don't need this file — just run
-- the full, updated supabase/schema.sql instead (it's safe to run schema.sql
-- again even on an existing database).
--
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run.

alter table majestic_permits add column if not exists revenue numeric not null default 0;
alter table majestic_permits add column if not exists job_cost numeric not null default 0;

create table if not exists income (
  id uuid primary key default uuid_generate_v4(),
  source text not null default '',
  category text not null default 'Regular',  -- Regular | Bonus | Majestic Permits
  amount numeric not null default 0,
  income_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_income_updated on income;
create trigger trg_income_updated before update on income
  for each row execute procedure set_updated_at();

alter table income enable row level security;
drop policy if exists "authenticated all" on income;
create policy "authenticated all" on income for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_income_date on income (income_date);
create index if not exists idx_income_category on income (category);
