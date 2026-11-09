// Поиск по каталогу: русское и оригинальное название плюс переводы (колонка search_text, миграция 010).
import type { SupabaseClient } from "@supabase/supabase-js";
import { toIlikePattern } from "@/lib/search";

/**
 * Возвращает построитель запроса с фильтром по названию.
 * Если миграция 010 ещё не выполнена, ищет только по русскому и оригинальному названию.
 */
export async function searchTitles<T>(
  supabase: SupabaseClient,
  q: string,
  columns: string,
  limit: number,
): Promise<{ data: T[]; error: string | null }> {
  const pattern = toIlikePattern(q);
  const run = (useSearchText: boolean) => {
    const base = supabase.from("titles").select(columns);
    const filtered = useSearchText
      ? base.ilike("search_text", pattern.toLowerCase())
      : base.or(`title.ilike.${pattern},original_title.ilike.${pattern}`);
    return filtered.order("tmdb_rating", { ascending: false, nullsFirst: false }).limit(limit);
  };
  let res = await run(true);
  if (res.error) res = await run(false);
  return { data: (res.data ?? []) as T[], error: res.error?.message ?? null };
}
