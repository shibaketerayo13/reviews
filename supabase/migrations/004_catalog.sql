-- Миграция 004: каталог с сортировками.
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

-- Тайтлы вместе со средней оценкой пользователей сайта: по ней можно сортировать
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
  s.avg_score,
  coalesce(s.ratings_count, 0) as ratings_count
from public.titles t
left join public.title_stats s on s.title_id = t.id;

grant select on public.catalog to anon, authenticated;

-- Индексы под сортировки и фильтры каталога
create index if not exists titles_release_date_idx on public.titles (release_date);
create index if not exists titles_tmdb_rating_idx on public.titles (tmdb_rating desc nulls last);
create index if not exists titles_created_at_idx on public.titles (created_at desc);
create index if not exists titles_media_type_idx on public.titles (media_type);
