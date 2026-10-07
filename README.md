# reviews

Сайт для оценки и обсуждения фильмов и сериалов.

- **Данные о фильмах и сериалах:** [TMDB API](https://developer.themoviedb.org)
- **База данных, вход и админка:** [Supabase](https://supabase.com)
- **Фреймворк:** Next.js (App Router) + TypeScript

## Возможности

- Регистрация и вход по email и паролю, профиль со своими оценками и средней оценкой
- Каталог фильмов и сериалов, страница тайтла, оценка 1–10 и текстовый отзыв
- Поиск: сначала по каталогу сайта, затем в TMDB по тому, чего в каталоге ещё нет
- Админка `/admin`: докачка из TMDB по поиску, быстрый импорт популярного и трендового, обновление и удаление

## Первый запуск

1. `npm install`
2. `copy .env.example .env.local` (macOS/Linux: `cp`) и впишите ключи
3. В Supabase → **SQL Editor** выполните `supabase/schema.sql`
4. В Supabase → **Authentication → URL Configuration**: Site URL `http://localhost:3000`, в Redirect URLs добавьте `http://localhost:3000/**`
5. `npm run dev`, зарегистрируйтесь на http://localhost:3000/login
6. В SQL Editor выполните `supabase/make-admin.sql` (с вашим email), чтобы стать админом

Проверка подключений: http://localhost:3000/api/health

## Переменные окружения

| Переменная | Где взять |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | TMDB → Settings → API → API Read Access Token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → publishable / anon key |

`.env.local` в `.gitignore`: ключи нельзя коммитить, репозиторий публичный.

## База данных

- `profiles`: имя на сайте и флаг `is_admin` (создаётся автоматически при регистрации)
- `titles`: каталог; добавлять и менять может только админ
- `ratings`: оценка 1–10 и отзыв, одна запись на пользователя и тайтл
- `title_stats`: представление со средней оценкой и числом оценок

Права закреплены в базе через Row Level Security, а не только в коде сайта.

## Структура

- `src/lib/tmdb.ts`: клиент TMDB (только сервер)
- `src/lib/supabase/*`: клиенты Supabase и обновление сессии
- `src/app/login`, `src/app/auth/callback`: вход и регистрация
- `src/app/profile`: профиль и мои оценки
- `src/app/title/[id]`: страница тайтла, оценка и отзывы
- `src/app/search`: поиск
- `src/app/admin`: админка

Данные о фильмах и сериалах предоставлены TMDB. Этот продукт использует API TMDB, но не одобрен и не сертифицирован TMDB.
