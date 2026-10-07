// Подсказки для живого поиска: до 8 фильмов из каталога и до 4 пользователей.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toIlikePattern } from "@/lib/search";
import { searchUsers, type UserHit } from "@/lib/users";

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
  const pattern = toIlikePattern(q.replace(/^@/, ""));
  // «@имя» — ищем только людей
  const onlyUsers = q.startsWith("@");
  const [titlesRes, users] = await Promise.all([
    supabase
      .from("titles")
      .select("id, title, original_title, media_type, release_date, poster_path, tmdb_rating")
      .or(`title.ilike.${pattern},original_title.ilike.${pattern}`)
      .order("tmdb_rating", { ascending: false, nullsFirst: false })
      .limit(onlyUsers ? 0 : 8),
    searchUsers(q, onlyUsers ? 8 : 4).catch((): UserHit[] => []),
  ]);

  if (titlesRes.error) {
    return NextResponse.json(
      { items: [], users, error: titlesRes.error.message },
      { status: 500 },
    );
  }

  const items: Suggestion[] = (titlesRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    original_title: t.original_title,
    media_type: t.media_type,
    year: t.release_date ? String(t.release_date).slice(0, 4) : "",
    poster_path: t.poster_path,
    tmdb_rating: t.tmdb_rating === null ? null : Number(t.tmdb_rating),
  }));

  const body: SuggestResponse = { items, users };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=30" } });
}
