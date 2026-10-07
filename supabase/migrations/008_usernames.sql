-- Миграция 008: короткие имена для публичных профилей (/u/имя).
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,30}$');

create unique index if not exists profiles_username_key
  on public.profiles (username);

-- Подбирает свободное имя на основе email: «ivan.petrov@…» → «ivanpetrov», при занятом — с цифрами
create or replace function public.make_username(p_seed text, p_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  base text := left(lower(regexp_replace(coalesce(p_seed, ''), '[^a-zA-Z0-9_]', '', 'g')), 24);
  candidate text;
  n integer := 0;
begin
  if length(base) < 3 then
    base := 'user' || substr(replace(p_id::text, '-', ''), 1, 6);
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate and id <> p_id) loop
    n := n + 1;
    candidate := base || '_' || n;
  end loop;
  return candidate;
end;
$$;

-- Имена для тех, кто уже зарегистрирован
do $$
declare
  r record;
begin
  for r in
    select p.id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
    order by p.created_at
  loop
    update public.profiles
    set username = public.make_username(split_part(r.email, '@', 1), r.id)
    where id = r.id;
  end loop;
end;
$$;

-- Новые пользователи получают имя автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    public.make_username(split_part(new.email, '@', 1), new.id)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Пользователь может менять имя, короткое имя и аватар (но не is_admin)
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, username) on public.profiles to authenticated;
