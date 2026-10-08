// Клиент TMDB API v3. Работает только на сервере: токен не должен попасть в браузер.
import { tmdbImg } from "@/lib/images";
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

/**
 * revalidate: сколько секунд кэшировать ответ (для страниц фильмов и актёров).
 * Без него запрос всегда свежий (поиск, админка).
 */
async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  revalidate?: number,
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
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
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

/** Картинка TMDB через прокси сайта (/img/t/…), см. lib/images.ts. */
export const posterUrl = (path: string | null, size = "w500") => tmdbImg(path, size);

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

/* =========================================================
   Подробности тайтла: актёры, режиссёры/создатели, похожие
   ========================================================= */

const DAY = 60 * 60 * 24;

export type Person = {
  id: number;
  name: string;
  role: string | null; // персонаж или должность
  profile_path: string | null;
};

type RawCast = {
  id: number;
  name: string;
  profile_path: string | null;
  character?: string;
  order?: number;
  roles?: { character: string; episode_count: number }[];
  total_episode_count?: number;
};
type RawCrew = {
  id: number;
  name: string;
  profile_path: string | null;
  job?: string;
  jobs?: { job: string }[];
};
type RawCredits = { cast: RawCast[]; crew: RawCrew[] };

type FullDetailsRaw = TmdbMedia & {
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  created_by?: { id: number; name: string; profile_path: string | null }[];
  credits?: RawCredits;
  aggregate_credits?: RawCredits;
  recommendations?: TmdbList;
  similar?: TmdbList;
};

export type FullDetails = {
  media: TmdbMedia;
  genres: string[];
  runtime: number | null; // минуты (у сериалов — серия)
  seasons: number | null;
  makersLabel: string; // «Режиссёр» / «Создатели»
  makers: Person[];
  cast: Person[];
  related: TmdbSearchItem[];
};

function hasJob(c: RawCrew, job: string) {
  return c.job === job || Boolean(c.jobs?.some((j) => j.job === job));
}

function uniqueById<T extends { id: number }>(list: T[]): T[] {
  const seen = new Set<number>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Всё для страницы тайтла одним запросом к TMDB (кэш на сутки). */
export async function getFullDetails(type: MediaType, id: number): Promise<FullDetails> {
  const credits = type === "movie" ? "credits" : "aggregate_credits";
  const d = await tmdbFetch<FullDetailsRaw>(
    `/${type}/${id}`,
    { append_to_response: `${credits},recommendations,similar` },
    DAY,
  );
  const c = (type === "movie" ? d.credits : d.aggregate_credits) ?? { cast: [], crew: [] };

  const cast: Person[] = uniqueById(
    [...c.cast].sort((a, b) =>
      type === "tv"
        ? (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0)
        : (a.order ?? 999) - (b.order ?? 999),
    ),
  )
    .slice(0, 18)
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.character || p.roles?.[0]?.character || null,
      profile_path: p.profile_path,
    }));

  let makers: Person[];
  let makersLabel: string;
  if (type === "movie") {
    const directors = uniqueById(c.crew.filter((p) => hasJob(p, "Director")));
    makersLabel = directors.length > 1 ? "Режиссёры" : "Режиссёр";
    makers = directors.map((p) => ({ ...p, role: null }));
  } else {
    const creators = d.created_by ?? [];
    makersLabel = creators.length > 1 ? "Создатели" : "Создатель";
    makers = creators.map((p) => ({ ...p, role: null }));
  }

  const pickRelated = (list?: TmdbList) =>
    (list?.results ?? [])
      .map((m) => ({ ...m, media_type: isMediaType(m.media_type) ? m.media_type : type }))
      .filter((m): m is TmdbSearchItem => Boolean(m.poster_path));
  const related = uniqueById([
    ...pickRelated(d.recommendations),
    ...pickRelated(d.similar),
  ]).slice(0, 12);

  return {
    media: d,
    genres: (d.genres ?? []).map((g) => g.name),
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    seasons: d.number_of_seasons ?? null,
    makersLabel,
    makers: makers.slice(0, 4),
    cast,
    related,
  };
}

/* =========================================================
   Персоны: актёры и режиссёры
   ========================================================= */

type RawPersonCredit = TmdbMedia & {
  character?: string;
  job?: string;
  episode_count?: number;
  vote_count?: number;
  genre_ids?: number[];
};

type PersonRaw = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  combined_credits?: { cast: RawPersonCredit[]; crew: RawPersonCredit[] };
};

export type PersonCredit = TmdbSearchItem & {
  role: string; // персонаж, «Режиссёр» и т. п.
  year: string;
  vote_count: number;
};

export type PersonDetails = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  department: string;
  credits: PersonCredit[];
};

const DEPARTMENT: Record<string, string> = {
  Acting: "Актёр",
  Directing: "Режиссёр",
  Writing: "Сценарист",
  Production: "Продюсер",
  Camera: "Оператор",
  Sound: "Композитор",
  Editing: "Монтажёр",
};

// Ток-шоу, новости и реалити засоряют фильмографию
const NOISE_GENRES = new Set([10767, 10763, 10764]);

export async function getPerson(id: number): Promise<PersonDetails> {
  const p = await tmdbFetch<PersonRaw>(
    `/person/${id}`,
    { append_to_response: "combined_credits" },
    DAY,
  );

  let biography = p.biography?.trim() ?? "";
  if (!biography) {
    // Русской биографии часто нет: берём английскую
    const en = await tmdbFetch<PersonRaw>(`/person/${id}`, { language: "en-US" }, DAY).catch(
      () => null,
    );
    biography = en?.biography?.trim() ?? "";
  }

  const all: PersonCredit[] = [];
  const cc = p.combined_credits ?? { cast: [], crew: [] };
  const push = (m: RawPersonCredit, role: string) => {
    if (!isMediaType(m.media_type)) return;
    if (m.genre_ids?.some((g) => NOISE_GENRES.has(g))) return;
    all.push({
      ...m,
      media_type: m.media_type,
      role,
      year: (m.release_date || m.first_air_date || "").slice(0, 4),
      vote_count: m.vote_count ?? 0,
    });
  };
  for (const m of cc.cast) push(m, m.character || "");
  for (const m of cc.crew) {
    if (m.job === "Director") push(m, "Режиссёр");
    else if (m.job === "Screenplay" || m.job === "Writer") push(m, "Сценарий");
  }

  // Один фильм может встречаться несколько раз (актёр и режиссёр): склеиваем роли
  const merged = new Map<string, PersonCredit>();
  for (const c of all) {
    const key = `${c.media_type}:${c.id}`;
    const prev = merged.get(key);
    if (!prev) merged.set(key, c);
    else if (c.role && !prev.role.includes(c.role)) {
      prev.role = prev.role ? `${prev.role}, ${c.role}` : c.role;
    }
  }

  return {
    id: p.id,
    name: p.name,
    biography,
    birthday: p.birthday,
    deathday: p.deathday,
    place_of_birth: p.place_of_birth,
    profile_path: p.profile_path,
    department: DEPARTMENT[p.known_for_department] ?? p.known_for_department ?? "",
    credits: [...merged.values()],
  };
}
