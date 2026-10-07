-- Миграция 005: оценка переводит «Посмотреть позже» в «Просмотрено».
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

create or replace function public.ratings_status_rule()
returns trigger
language plpgsql
as $$
begin
  -- Поставили оценку фильму из «Посмотреть позже» — значит, уже посмотрели
  if new.score is not null and new.status = 'planned' then
    new.status := 'watched';
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_status_rule on public.ratings;
create trigger ratings_status_rule
  before insert or update on public.ratings
  for each row execute function public.ratings_status_rule();

-- Исправляем записи, которые уже нарушают правило
update public.ratings
set status = 'watched'
where status = 'planned' and score is not null;
