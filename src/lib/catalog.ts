import { createClient } from "@/lib/supabase/server";
import type { TitleStat } from "@/lib/types";

/** Средние оценки и количество оценок для списка тайтлов. */
export async function getTitleStats(
  ids: number[],
): Promise<Map<number, TitleStat>> {
  const map = new Map<number, TitleStat>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("title_stats")
    .select("title_id, avg_score, ratings_count")
    .in("title_id", ids);
  for (const row of data ?? []) {
    map.set(row.title_id, {
      avg: Number(row.avg_score),
      count: Number(row.ratings_count),
    });
  }
  return map;
}

/** Какие из найденных в TMDB тайтлов уже есть в каталоге: ключи "movie:123". */
export async function existingKeys(
  items: { id: number; media_type: string }[],
): Promise<Set<string>> {
  const set = new Set<string>();
  if (items.length === 0) return set;
  const supabase = await createClient();
  const { data } = await supabase
    .from("titles")
    .select("tmdb_id, media_type")
    .in(
      "tmdb_id",
      items.map((i) => i.id),
    );
  for (const row of data ?? []) {
    set.add(`${row.media_type}:${row.tmdb_id}`);
  }
  return set;
}

/** Для тайтлов из TMDB: какой у них id в каталоге сайта ("movie:123" → 45). */
export async function catalogIdMap(
  items: { id: number; media_type: string }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (items.length === 0) return map;
  const supabase = await createClient();
  const ids = [...new Set(items.map((i) => i.id))].slice(0, 400);
  const { data } = await supabase
    .from("titles")
    .select("id, tmdb_id, media_type")
    .in("tmdb_id", ids);
  for (const row of data ?? []) {
    map.set(`${row.media_type}:${row.tmdb_id}`, row.id);
  }
  return map;
}

/** Ссылка на тайтл: страница в каталоге или превью из TMDB. */
export function titleHref(
  item: { id: number; media_type: string },
  ids: Map<string, number>,
): string {
  const local = ids.get(`${item.media_type}:${item.id}`);
  return local ? `/title/${local}` : `/tmdb/${item.media_type}/${item.id}`;
}
