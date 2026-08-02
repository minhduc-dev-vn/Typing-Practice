create extension if not exists pgcrypto;

create table if not exists public.ai_content_cache (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('en', 'vi')),
  topic text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  length text not null check (length in ('short', 'medium', 'long')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (language, topic, difficulty, length)
);

create table if not exists public.generate_usage (
  session_id text primary key,
  count int not null default 0 check (count >= 0),
  reset_at timestamptz not null
);

alter table public.ai_content_cache enable row level security;
alter table public.generate_usage enable row level security;

create or replace function public.consume_generate_usage(
  p_session_id text,
  p_limit int,
  p_now timestamptz default now()
)
returns table (
  allowed boolean,
  current_count int,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.generate_usage%rowtype;
begin
  insert into public.generate_usage as usage (session_id, count, reset_at)
  values (p_session_id, 1, p_now + interval '24 hours')
  on conflict (session_id) do update
    set count = case
      when usage.reset_at <= p_now then 1
      else usage.count + 1
    end,
    reset_at = case
      when usage.reset_at <= p_now then p_now + interval '24 hours'
      else usage.reset_at
    end
  returning * into usage_row;

  return query
    select usage_row.count <= p_limit, usage_row.count, usage_row.reset_at;
end;
$$;

revoke all on table public.ai_content_cache from anon, authenticated;
revoke all on table public.generate_usage from anon, authenticated;
revoke all on function public.consume_generate_usage(text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_generate_usage(text, int, timestamptz) to service_role;
