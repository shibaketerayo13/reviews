-- Схема базы для reviews.
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Файл можно запускать повторно: он ничего не ломает и не удаляет данные.

-- ============ Профили ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для тех, кто уже зарегистрирован
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Проверка "текущий пользователь админ" (без рекурсии в политиках)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============ Каталог фильмов и сериалов ============
create table if not exists public.titles (
  id bigint generated always as identity primary key,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  original_title text,
  overview text,
  poster_path text,
  backdrop_path text,
  release_date date,
  tmdb_rating numeric(3, 1),
  created_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);

create index if not exists titles_title_idx on public.titles (lower(title));

-- ============ Оценки и отзывы ============
create table if not exists public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id bigint not null references public.titles (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  review text check (review is null or char_length(review) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index if not exists ratings_title_idx on public.ratings (title_id);

-- Средняя оценка и число оценок по каждому тайтлу
create or replace view public.title_stats
with (security_invoker = true) as
select
  title_id,
  round(avg(score)::numeric, 1) as avg_score,
  count(*) as ratings_count
from public.ratings
group by title_id;

-- ============ Права доступа (RLS) ============
alter table public.profiles enable row level security;
alter table public.titles enable row level security;
alter table public.ratings enable row level security;

-- profiles: читать могут все, менять только свою строку и только имя
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- RLS не умеет ограничивать колонки, поэтому is_admin закрываем правами:
-- менять можно только display_name. Админа назначают из SQL Editor.
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- titles: читать все, добавлять/менять/удалять только админ
drop policy if exists "titles read" on public.titles;
create policy "titles read" on public.titles
  for select using (true);

drop policy if exists "titles admin insert" on public.titles;
create policy "titles admin insert" on public.titles
  for insert with check (public.is_admin());

drop policy if exists "titles admin update" on public.titles;
create policy "titles admin update" on public.titles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "titles admin delete" on public.titles;
create policy "titles admin delete" on public.titles
  for delete using (public.is_admin());

-- ratings: читать все, писать только свои
drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings
  for select using (true);

drop policy if exists "ratings insert own" on public.ratings;
create policy "ratings insert own" on public.ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "ratings update own" on public.ratings;
create policy "ratings update own" on public.ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ratings delete own" on public.ratings;
create policy "ratings delete own" on public.ratings
  for delete using (auth.uid() = user_id);

grant select on public.title_stats to anon, authenticated;

-- ============ Миграции (уже включены в этот файл) ============
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

-- Миграция 003: аватары пользователей.
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

-- Ссылка на аватар в профиле
alter table public.profiles
  add column if not exists avatar_url text;

-- Пользователь может менять у себя только имя и аватар (не is_admin)
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- Хранилище картинок: публичное чтение, до 2 МБ, только изображения
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Каждый пишет только в свою папку avatars/<id пользователя>/...
drop policy if exists "reviews avatars read" on storage.objects;
create policy "reviews avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "reviews avatars insert own" on storage.objects;
create policy "reviews avatars insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reviews avatars update own" on storage.objects;
create policy "reviews avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reviews avatars delete own" on storage.objects;
create policy "reviews avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
