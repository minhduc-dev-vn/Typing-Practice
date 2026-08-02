create table if not exists public.practice_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('words', 'sentences', 'paragraph')),
  language text not null check (language in ('en', 'vi')),
  topic text,
  wpm numeric not null check (wpm >= 0),
  accuracy numeric not null check (accuracy >= 0 and accuracy <= 100),
  cpm numeric not null check (cpm >= 0),
  errors int not null check (errors >= 0),
  duration_seconds int not null check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (char_length(trim(topic)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, topic)
);

create index if not exists practice_history_user_created_idx
  on public.practice_history (user_id, created_at desc);

create index if not exists favorite_topics_user_created_idx
  on public.favorite_topics (user_id, created_at desc);

alter table public.practice_history enable row level security;
alter table public.practice_history force row level security;
alter table public.favorite_topics enable row level security;
alter table public.favorite_topics force row level security;

create policy "practice_history_select_own"
  on public.practice_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "practice_history_insert_own"
  on public.practice_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "practice_history_update_own"
  on public.practice_history for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "practice_history_delete_own"
  on public.practice_history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorite_topics_select_own"
  on public.favorite_topics for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorite_topics_insert_own"
  on public.favorite_topics for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "favorite_topics_update_own"
  on public.favorite_topics for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "favorite_topics_delete_own"
  on public.favorite_topics for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.practice_history from anon;
revoke all on table public.favorite_topics from anon;
grant select, insert, update, delete on table public.practice_history to authenticated;
grant select, insert, update, delete on table public.favorite_topics to authenticated;
