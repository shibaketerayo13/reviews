// Параметры каталога: общие для сервера (запрос) и клиента (панель фильтров).
// Подписи — в словаре (t.catalog), здесь только допустимые значения.

export const SORTS = ["tmdb", "site", "year_desc", "year_asc", "added", "title"] as const;
export type Sort = (typeof SORTS)[number];

export const TYPES = ["all", "movie", "tv"] as const;
export type TypeFilter = (typeof TYPES)[number];

export const DECADES = ["all", "2020", "2010", "2000", "1990", "1980", "1970", "1960", "1950", "old"] as const;
export type Decade = (typeof DECADES)[number];

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

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
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

/** Подпись десятилетия: «2010-е», «До 1950», «Любые годы». */
export function decadeLabel(
  d: Decade,
  labels: { anyYears: string; decade: string; before1950: string },
): string {
  if (d === "all") return labels.anyYears;
  if (d === "old") return labels.before1950;
  return labels.decade.replace("{d}", d);
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
