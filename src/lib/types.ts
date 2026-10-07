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
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  is_admin: boolean;
};

export type TitleStat = { avg: number; count: number };

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
