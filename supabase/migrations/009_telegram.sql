-- Миграция 009: Telegram-бот.
-- Привязка Telegram к аккаунту и учёт фильмов, добавленных пользователями через бота.
-- Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
-- Можно запускать повторно.

-- Один аккаунт ↔ один Telegram
create table if not exists public.telegram_links (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  telegram_id bigint not null unique,
  telegram_username text,
  linked_at timestamptz not null default now()
);

alter table public.telegram_links enable row level security;

-- Пользователь видит и может отвязать только свою привязку.
-- Создаёт привязку только бот (сервисный ключ на сервере), поэтому политики insert нет.
drop policy if exists "telegram links read own" on public.telegram_links;
create policy "telegram links read own" on public.telegram_links
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "telegram links delete own" on public.telegram_links;
create policy "telegram links delete own" on public.telegram_links
  for delete to authenticated using (user_id = auth.uid());

-- Одноразовые коды привязки: живут 15 минут. Политик нет, доступ только через функцию и бота.
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

alter table public.telegram_link_codes enable row level security;

-- Выдаёт вошедшему пользователю новый код (старые его коды удаляются)
create or replace function public.create_telegram_link_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from public.telegram_link_codes
  where user_id = auth.uid() or expires_at < now();

  -- 48 случайных символов: подходит для ссылки t.me/бот?start=код (до 64 символов)
  v_code := left(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    48
  );

  insert into public.telegram_link_codes (code, user_id) values (v_code, auth.uid());
  return v_code;
end;
$$;

revoke all on function public.create_telegram_link_code() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;

-- Кто добавил фильм в каталог (для фильмов, докачанных через бота, и для дневного лимита)
alter table public.titles
  add column if not exists added_by uuid references public.profiles (id) on delete set null;

create index if not exists titles_added_by_idx
  on public.titles (added_by, created_at desc)
  where added_by is not null;
