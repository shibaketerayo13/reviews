// Подсказки для живого поиска: до 8 фильмов из каталога и до 4 пользователей.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchTitles } from "@/lib/title-search";
import { searchUsers, type UserHit } from "@/lib/users";
import { getLocale } from "@/lib/i18n/server";
import { localTitle, type TitleTranslations } from "@/lib/i18n/content";

export const dynamic = "force-dynamic";

export type Suggestion = {
  id: number;
  title: string;
  original_title: string | null;
  media_type: "movie" | "tv";
  year: string;
  poster_path: string | null;
  tmdb_rating: number | null;
};

export type SuggestResponse = { items: Suggestion[]; users: UserHit[] };

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [], users: [] });

  const supabase = await createClient();
  // «@имя» — ищем только людей
  const onlyUsers = q.startsWith("@");
  type Row = {
    id: number;
    title: string;
    original_title: string | null;
    media_type: "movie" | "tv";
    release_date: string | null;
    poster_path: string | null;
    tmdb_rating: number | null;
    translations?: TitleTranslations | null;
  };
  const [titlesRes, users, locale] = await Promise.all([
    onlyUsers
      ? Promise.resolve({ data: [] as Row[], error: null })
      : searchTitles<Row>(supabase, q, "*", 8),
    searchUsers(q, onlyUsers ? 8 : 4).catch((): UserHit[] => []),
    getLocale(),
  ]);

  if (titlesRes.error) {
    return NextResponse.json({ items: [], users, error: titlesRes.error }, { status: 500 });
  }

  const items: Suggestion[] = titlesRes.data.map((t) => ({
    id: t.id,
    title: localTitle(t, locale),
    original_title: t.original_title,
    media_type: t.media_type,
    year: t.release_date ? String(t.release_date).slice(0, 4) : "",
    poster_path: t.poster_path,
    tmdb_rating: t.tmdb_rating === null ? null : Number(t.tmdb_rating),
  }));

  const body: SuggestResponse = { items, users };
  // Ответ зависит от языка: кэшируем только в браузере и с учётом cookie
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
