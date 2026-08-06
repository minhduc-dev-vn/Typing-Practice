alter table public.practice_history
  drop constraint if exists practice_history_mode_check;

alter table public.practice_history
  add constraint practice_history_mode_check
  check (mode in ('words', 'sentences', 'paragraph', 'custom'));
