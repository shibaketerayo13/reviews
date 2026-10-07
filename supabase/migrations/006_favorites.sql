-- Миграция 006: «Любимые» — отметка поверх статуса (фильм остаётся «Просмотренным»).
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

alter table public.ratings
  add column if not exists is_favorite boolean not null default false;

alter table public.ratings
  add column if not exists favorited_at timestamptz;

create index if not exists ratings_user_favorites_idx
  on public.ratings (user_id, favorited_at desc)
  where is_favorite;
