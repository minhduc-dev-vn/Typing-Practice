create table if not exists public.topic_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_topic text not null unique,
  related_topic text not null,
  created_at timestamptz not null default now(),
  constraint topic_suggestions_source_topic_length check (char_length(source_topic) between 2 and 80),
  constraint topic_suggestions_related_topic_length check (char_length(related_topic) between 2 and 80)
);

alter table public.topic_suggestions enable row level security;
alter table public.topic_suggestions force row level security;

-- This is a shared server-side cache. Authenticated and anonymous browser
-- clients cannot read or mutate it; API routes use the service role.
revoke all on table public.topic_suggestions from anon, authenticated;

