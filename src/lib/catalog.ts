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
