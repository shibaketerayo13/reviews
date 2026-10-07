// Данные профиля: общие для своего профиля (/profile) и публичного (/u/имя).
import { createClient } from "@/lib/supabase/server";
import { yearOf, type Title, type WatchStatus } from "@/lib/types";
import type { ProfileEntry } from "@/components/ProfileEntries";

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
    "id" | "title" | "original_title" | "media_type" | "poster_path" | "release_date"
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
  const { data } = await supabase
    .from("ratings")
    .select(
      "status, score, review, is_favorite, favorited_at, updated_at, titles(id, title, original_title, media_type, poster_path, release_date)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

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

export function toProfileEntry(e: Entry): ProfileEntry {
  const t = e.titles!;
  return {
    titleId: t.id,
    title: t.title,
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

export function formatSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
