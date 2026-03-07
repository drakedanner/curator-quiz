-- Run this in the Supabase SQL editor to set up your tables

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  ens_name text,
  created_at timestamptz default now()
);

create table if not exists quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  score integer not null,
  total integer not null,
  category text not null default 'all',
  answers jsonb not null default '[]',
  created_at timestamptz default now()
);

create index idx_quiz_rounds_user on quiz_rounds(user_id);
create index idx_quiz_rounds_created on quiz_rounds(created_at desc);

-- Row Level Security
alter table users enable row level security;
alter table quiz_rounds enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on users for select
  using (id = auth.uid()::uuid);

-- Quiz rounds: users can read and insert their own
create policy "Users can read own rounds"
  on quiz_rounds for select
  using (user_id = auth.uid()::uuid);

create policy "Users can insert own rounds"
  on quiz_rounds for insert
  with check (user_id = auth.uid()::uuid);
