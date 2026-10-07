// Клиент TMDB API v3. Работает только на сервере: токен не должен попасть в браузер.
const BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type TmdbMedia = {
  id: number;
  title?: string; // фильмы
  name?: string; // сериалы
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

type TmdbList = { page: number; results: TmdbMedia[]; total_pages: number };

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
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}: ${res.statusText} (${path})`);
  }
  return res.json() as Promise<T>;
}

export const getTrendingMovies = () =>
  tmdbFetch<TmdbList>("/trending/movie/week");

export const getTrendingTv = () => tmdbFetch<TmdbList>("/trending/tv/week");

export const searchMulti = (query: string, page = 1) =>
  tmdbFetch<TmdbList>("/search/multi", { query, page: String(page) });

export const getMovie = (id: number) =>
  tmdbFetch<TmdbMedia>(`/movie/${id}`);

export const getTv = (id: number) => tmdbFetch<TmdbMedia>(`/tv/${id}`);

export const posterUrl = (path: string | null, size = "w500") =>
  path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
