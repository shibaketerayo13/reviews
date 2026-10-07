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
  is_admin: boolean;
};

export type TitleStat = { avg: number; count: number };

export const MEDIA_LABEL: Record<Title["media_type"], string> = {
  movie: "Фильм",
  tv: "Сериал",
};

export function yearOf(date: string | null | undefined): string {
  return date ? date.slice(0, 4) : "";
}
