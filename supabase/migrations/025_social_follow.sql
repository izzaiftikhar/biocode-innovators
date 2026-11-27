create table if not exists public.social_follow (
  user_id uuid primary key references auth.users(id) on delete cascade,
  linkedin boolean not null default false,
  instagram boolean not null default false,
  youtube boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.social_follow enable row level security;

create policy "read own follow" on public.social_follow
  for select using (auth.uid() = user_id);
create policy "insert own follow" on public.social_follow
  for insert with check (auth.uid() = user_id);
create policy "update own follow" on public.social_follow
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);