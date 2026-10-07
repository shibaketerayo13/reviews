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
