import type { TitleTranslations } from "@/lib/i18n/content";

export type Title = {
  id: number;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  tmdb_rating: number | null;
  created_at: string;
  /** Переводы из TMDB (миграция 010). У старых записей может отсутствовать. */
  translations?: TitleTranslations | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  is_admin: boolean;
};

export type TitleStat = { avg: number; count: number };

// Русские подписи — для Telegram-бота и админки. На сайте подписи берутся из словаря (lib/i18n).
export const MEDIA_LABEL: Record<Title["media_type"], string> = {
  movie: "Фильм",
  tv: "Сериал",
};

export const WATCH_STATUSES = ["watched", "planned", "dropped"] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const STATUS_LABEL: Record<WatchStatus, string> = {
  watched: "Просмотрено",
  planned: "Посмотреть позже",
  dropped: "Брошено",
};

export function isWatchStatus(value: unknown): value is WatchStatus {
  return WATCH_STATUSES.includes(value as WatchStatus);
}

export function yearOf(date: string | null | undefined): string {
  return date ? date.slice(0, 4) : "";
}
