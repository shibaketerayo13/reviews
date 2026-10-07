-- Миграция 002: статусы просмотра в профиле.
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно. Существующие оценки станут статусом "просмотрено".

-- Статус: просмотрено / посмотреть позже / брошено
alter table public.ratings
  add column if not exists status text not null default 'watched';

alter table public.ratings
  drop constraint if exists ratings_status_check;
alter table public.ratings
  add constraint ratings_status_check
  check (status in ('watched', 'planned', 'dropped'));

-- Оценка теперь необязательна (например, для "посмотреть позже")
alter table public.ratings
  alter column score drop not null;

create index if not exists ratings_user_status_idx
  on public.ratings (user_id, status);

-- Средняя оценка считается только по записям, где оценка поставлена
create or replace view public.title_stats
with (security_invoker = true) as
select
  title_id,
  round(avg(score)::numeric, 1) as avg_score,
  count(score) as ratings_count
from public.ratings
where score is not null
group by title_id;

grant select on public.title_stats to anon, authenticated;
