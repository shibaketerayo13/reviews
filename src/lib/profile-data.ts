// Данные профиля: общие для своего профиля (/profile) и публичного (/u/имя).
import { createClient } from "@/lib/supabase/server";
import { yearOf, type Title, type WatchStatus } from "@/lib/types";
import type { ProfileEntry } from "@/components/ProfileEntries";
import type { Locale } from "@/lib/i18n/config";
import { localTitle } from "@/lib/i18n/content";

export type Tab = "all" | WatchStatus;

export type Entry = {
  status: WatchStatus;
  score: number | null;
  review: string | null;
  is_favorite: boolean;
  favorited_at: string | null;
  updated_at: string;
  titles: Pick<
    Title,
    "id" | "title" | "original_title" | "media_type" | "poster_path" | "release_date" | "translations"
  > | null;
};

export type ProfileData = {
  all: Entry[];
  counts: Record<Tab, number>;
  scoredCount: number;
  avg: string;
  favorites: Entry[];
};

export async function loadProfileData(userId: string): Promise<ProfileData> {
  const supabase = await createClient();
  const query = (titleCols: string) =>
    supabase
      .from("ratings")
      .select(`status, score, review, is_favorite, favorited_at, updated_at, titles(${titleCols})`)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
  const base = "id, title, original_title, media_type, poster_path, release_date";
  let { data, error } = await query(`${base}, translations`);
  // Миграция 010 ещё не выполнена: колонки translations нет — читаем без неё
  if (error) ({ data } = await query(base));

  const all = ((data ?? []) as unknown as Entry[]).filter((e) => e.titles);
  const scored = all.filter((e) => e.score !== null);
  return {
    all,
    counts: {
      all: all.length,
      watched: all.filter((e) => e.status === "watched").length,
      planned: all.filter((e) => e.status === "planned").length,
      dropped: all.filter((e) => e.status === "dropped").length,
    },
    scoredCount: scored.length,
    avg:
      scored.length > 0
        ? (scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length).toFixed(1)
        : "—",
    favorites: all
      .filter((e) => e.is_favorite)
      .sort((a, b) => (b.favorited_at ?? "").localeCompare(a.favorited_at ?? "")),
  };
}

/** Название фильма в записи профиля на нужном языке. */
export function entryTitle(e: Entry, locale: Locale): string {
  const t = e.titles!;
  return localTitle(t, locale);
}

export function toProfileEntry(e: Entry, locale: Locale): ProfileEntry {
  const t = e.titles!;
  return {
    titleId: t.id,
    title: localTitle(t, locale),
    originalTitle: t.original_title,
    mediaType: t.media_type,
    year: yearOf(t.release_date),
    posterPath: t.poster_path,
    status: e.status,
    score: e.score,
    review: e.review,
    isFavorite: Boolean(e.is_favorite),
  };
}

export { formatDate as formatSince } from "@/lib/i18n/config";
