-- Миграция 007: админ может заменить фильм в каталоге на правильный из TMDB.
-- Оценки, отзывы и «любимые» пользователей сохраняются.
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

create or replace function public.admin_replace_title(p_title_id bigint, p_row jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := p_row ->> 'media_type';
  v_tmdb integer := (p_row ->> 'tmdb_id')::integer;
  v_target bigint;
begin
  if not public.is_admin() then
    raise exception 'Только для администратора';
  end if;
  if v_type not in ('movie', 'tv') or v_tmdb is null then
    raise exception 'Неверные данные';
  end if;

  -- Правильный фильм уже есть в каталоге: переносим записи туда, ошибочную карточку удаляем
  select id into v_target
  from public.titles
  where media_type = v_type and tmdb_id = v_tmdb and id <> p_title_id;

  if v_target is not null then
    insert into public.ratings
      (user_id, title_id, status, score, review, is_favorite, favorited_at, created_at, updated_at)
    select user_id, v_target, status, score, review, is_favorite, favorited_at, created_at, updated_at
    from public.ratings
    where title_id = p_title_id
    on conflict (user_id, title_id) do nothing;

    delete from public.titles where id = p_title_id;
    return v_target;
  end if;

  -- Иначе просто перепривязываем карточку к правильному фильму
  update public.titles set
    tmdb_id = v_tmdb,
    media_type = v_type,
    title = coalesce(p_row ->> 'title', title),
    original_title = p_row ->> 'original_title',
    overview = p_row ->> 'overview',
    poster_path = p_row ->> 'poster_path',
    backdrop_path = p_row ->> 'backdrop_path',
    release_date = nullif(p_row ->> 'release_date', '')::date,
    tmdb_rating = nullif(p_row ->> 'tmdb_rating', '')::numeric
  where id = p_title_id;

  return p_title_id;
end;
$$;

revoke all on function public.admin_replace_title(bigint, jsonb) from public, anon;
grant execute on function public.admin_replace_title(bigint, jsonb) to authenticated;
