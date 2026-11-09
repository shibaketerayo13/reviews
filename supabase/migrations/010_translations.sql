-- Миграция 010: названия и описания фильмов на других языках (беларуский, польский, английский).
-- Основной язык каталога — русский (title / overview). Переводы из TMDB лежат в translations:
--   {"en": {"title": "...", "overview": "..."}, "pl": {...}, "be": {...}}
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run. Можно запускать повторно.

alter table public.titles
  add column if not exists translations jsonb not null default '{}'::jsonb;

-- Текст для поиска: русское и оригинальное название плюс переводы названия
alter table public.titles
  add column if not exists search_text text generated always as (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(original_title, '') || ' ' ||
      coalesce(translations -> 'en' ->> 'title', '') || ' ' ||
      coalesce(translations -> 'pl' ->> 'title', '') || ' ' ||
      coalesce(translations -> 'be' ->> 'title', '')
    )
  ) stored;

-- Каталог отдаёт и переводы
drop view if exists public.catalog;
create view public.catalog
with (security_invoker = true) as
select
  t.id,
  t.tmdb_id,
  t.media_type,
  t.title,
  t.original_title,
  t.overview,
  t.poster_path,
  t.backdrop_path,
  t.release_date,
  t.tmdb_rating,
  t.created_at,
  t.translations,
  s.avg_score,
  coalesce(s.ratings_count, 0) as ratings_count
from public.titles t
left join public.title_stats s on s.title_id = t.id;

grant select on public.catalog to anon, authenticated;
