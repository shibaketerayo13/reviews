// Подсказки для живого поиска: до 8 совпадений из каталога.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toIlikePattern } from "@/lib/search";

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

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const supabase = await createClient();
  const pattern = toIlikePattern(q);
  const { data, error } = await supabase
    .from("titles")
    .select("id, title, original_title, media_type, release_date, poster_path, tmdb_rating")
    .or(`title.ilike.${pattern},original_title.ilike.${pattern}`)
    .order("tmdb_rating", { ascending: false, nullsFirst: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }

  const items: Suggestion[] = (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    original_title: t.original_title,
    media_type: t.media_type,
    year: t.release_date ? String(t.release_date).slice(0, 4) : "",
    poster_path: t.poster_path,
    tmdb_rating: t.tmdb_rating === null ? null : Number(t.tmdb_rating),
  }));

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
