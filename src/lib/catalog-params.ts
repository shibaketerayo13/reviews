// Параметры каталога: общие для сервера (запрос) и клиента (панель фильтров).

export const SORTS = {
  tmdb: "Рейтинг TMDB",
  site: "Оценки сайта",
  year_desc: "Сначала новые",
  year_asc: "Сначала старые",
  added: "Недавно добавленные",
  title: "По алфавиту",
} as const;
export type Sort = keyof typeof SORTS;

export const TYPES = { all: "Всё", movie: "Фильмы", tv: "Сериалы" } as const;
export type TypeFilter = keyof typeof TYPES;

export const DECADES = {
  all: "Любые годы",
  "2020": "2020-е",
  "2010": "2010-е",
  "2000": "2000-е",
  "1990": "1990-е",
  "1980": "1980-е",
  "1970": "1970-е",
  "1960": "1960-е",
  "1950": "1950-е",
  old: "До 1950",
} as const;
export type Decade = keyof typeof DECADES;

export type CatalogParams = {
  type: TypeFilter;
  decade: Decade;
  sort: Sort;
  page: number;
};

export const DEFAULTS: CatalogParams = {
  type: "all",
  decade: "all",
  sort: "tmdb",
  page: 1,
};

function pick<T extends string>(value: unknown, allowed: Record<T, string>, fallback: T): T {
  return typeof value === "string" && value in allowed ? (value as T) : fallback;
}

export function parseCatalogParams(sp: Record<string, string | undefined>): CatalogParams {
  const page = Number(sp.page);
  return {
    type: pick(sp.type, TYPES, DEFAULTS.type),
    decade: pick(sp.decade, DECADES, DEFAULTS.decade),
    sort: pick(sp.sort, SORTS, DEFAULTS.sort),
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

/** Ссылка на каталог: параметры по умолчанию не попадают в адрес. */
export function catalogHref(p: Partial<CatalogParams>): string {
  const params = new URLSearchParams();
  const merged = { ...DEFAULTS, ...p };
  if (merged.type !== DEFAULTS.type) params.set("type", merged.type);
  if (merged.decade !== DEFAULTS.decade) params.set("decade", merged.decade);
  if (merged.sort !== DEFAULTS.sort) params.set("sort", merged.sort);
  if (merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}
