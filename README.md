# reviews

Сайт для оценки и обсуждения фильмов и сериалов.

- **Данные о фильмах и сериалах:** [TMDB API](https://developer.themoviedb.org)
- **База данных и админка:** [Supabase](https://supabase.com)
- **Фреймворк:** Next.js (App Router) + TypeScript

## Запуск

```bash
npm install
cp .env.example .env.local   # затем впишите ключи (на Windows: copy .env.example .env.local)
npm run dev
```

Откройте http://localhost:3000. Проверка подключения к TMDB и Supabase: http://localhost:3000/api/health.

## Переменные окружения

| Переменная | Где взять |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | TMDB → Settings → API → API Read Access Token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon / public key |

`.env.local` в `.gitignore`: ключи нельзя коммитить, репозиторий публичный.

## Структура

- `src/lib/tmdb.ts` — клиент TMDB (только сервер)
- `src/lib/supabase/client.ts` и `server.ts` — клиенты Supabase
- `src/app/api/health/route.ts` — проверка подключений

Данные о фильмах и сериалах предоставлены TMDB. Этот продукт использует API TMDB, но не одобрен и не сертифицирован TMDB.
