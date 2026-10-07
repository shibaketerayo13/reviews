// Клиент TMDB API v3. Работает только на сервере: токен не должен попасть в браузер.
const BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type MediaType = "movie" | "tv";

export type TmdbMedia = {
  id: number;
  media_type?: string;
  title?: string; // фильмы
  name?: string; // сериалы
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

export type TmdbSearchItem = TmdbMedia & { media_type: MediaType };

type TmdbList = { page: number; results: TmdbMedia[]; total_pages: number };

export function isMediaType(value: unknown): value is MediaType {
  return value === "movie" || value === "tv";
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) {
    throw new Error("TMDB_READ_ACCESS_TOKEN не задан (см. .env.example)");
  }
  const url = new URL(BASE_URL + path);
  url.searchParams.set("language", "ru-RU");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}: ${res.statusText} (${path})`);
  }
  return res.json() as Promise<T>;
}

export type ListSource = "popular" | "trending" | "top_rated";

export function isListSource(value: unknown): value is ListSource {
  return value === "popular" || value === "trending" || value === "top_rated";
}

/** Одна страница списка TMDB (20 штук). */
export function getList(type: MediaType, source: ListSource, page = 1) {
  const path =
    source === "trending" ? `/trending/${type}/week` : `/${type}/${source}`;
  return tmdbFetch<TmdbList>(path, { page: String(page) });
}

type FindResult = {
  movie_results: TmdbMedia[];
  tv_results: TmdbMedia[];
};

/** Найти фильм или сериал в TMDB по IMDb ID (tt1234567). */
export async function findByImdbId(
  imdbId: string,
): Promise<{ type: MediaType; media: TmdbMedia } | null> {
  const data = await tmdbFetch<FindResult>(`/find/${imdbId}`, {
    external_source: "imdb_id",
  });
  if (data.movie_results[0]) return { type: "movie", media: data.movie_results[0] };
  if (data.tv_results[0]) return { type: "tv", media: data.tv_results[0] };
  return null;
}

export const getDetails = (type: MediaType, id: number) =>
  tmdbFetch<TmdbMedia>(`/${type}/${id}`);

/** Поиск по фильмам и сериалам (люди из выдачи убираются). */
export async function searchMovieTv(query: string): Promise<TmdbSearchItem[]> {
  const data = await tmdbFetch<TmdbList>("/search/multi", {
    query,
    include_adult: "false",
  });
  return data.results.filter((r): r is TmdbSearchItem =>
    isMediaType(r.media_type),
  );
}

export const posterUrl = (path: string | null, size = "w500") =>
  path ? `${IMAGE_BASE_URL}/${size}${path}` : null;

/** Строка для таблицы titles в Supabase. */
export function toTitleRow(type: MediaType, m: TmdbMedia) {
  return {
    tmdb_id: m.id,
    media_type: type,
    title: m.title ?? m.name ?? "Без названия",
    original_title: m.original_title ?? m.original_name ?? null,
    overview: m.overview || null,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    release_date: m.release_date || m.first_air_date || null,
    tmdb_rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
  };
}
