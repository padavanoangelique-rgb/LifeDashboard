-- Adds the new Time Blocking feature to a database that already has the
-- rest of the schema applied. If you haven't deployed yet, you don't need
-- this file — just run the full, updated supabase/schema.sql instead (it's
-- safe to run schema.sql again even on an existing database; every
-- statement in it is written to be re-runnable).
--
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists time_blocks (
  id uuid primary key default uuid_generate_v4(),
  block_date date not null default current_date,
  start_time text not null default '09:00',
  end_time text not null default '10:00',
  label text not null default '',
  color text not null default '#2a78d6',
  goal_id uuid references goals(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_time_blocks_updated on time_blocks;
create trigger trg_time_blocks_updated before update on time_blocks
  for each row execute procedure set_updated_at();

alter table time_blocks enable row level security;
drop policy if exists "authenticated all" on time_blocks;
create policy "authenticated all" on time_blocks for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_time_blocks_date on time_blocks (block_date);
create index if not exists idx_time_blocks_goal on time_blocks (goal_id);
