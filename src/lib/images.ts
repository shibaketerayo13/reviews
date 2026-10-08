// Адреса картинок. Постеры TMDB и аватары из Supabase отдаются через сам сайт
// (/img/...), а не напрямую с image.tmdb.org и *.supabase.co: TMDB ограничивает доступ
// из некоторых стран (например, из Беларуси), и там постеры не загружались бы.
// Файл без серверных зависимостей: им пользуются и клиентские компоненты.

export const TMDB_IMAGE_ORIGIN = "https://image.tmdb.org/t/p";

/** Размеры TMDB, которые пропускает прокси /img/t/… */
export const TMDB_SIZES = [
  "w92",
  "w154",
  "w185",
  "w300",
  "w342",
  "w500",
  "w780",
  "w1280",
  "h632",
  "original",
] as const;

/** Постер, кадр или фото актёра через прокси сайта. */
export function tmdbImg(path: string | null | undefined, size: string): string | null {
  return path ? `/img/t/${size}${path}` : null;
}

const AVATAR_PREFIX = "/storage/v1/object/public/avatars/";

/** Аватар из Supabase Storage → адрес через прокси сайта. Прочие ссылки не меняются. */
export function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const at = url.indexOf(AVATAR_PREFIX);
  if (at === -1 || !url.includes(".supabase.co")) return url;
  return `/img/a/${url.slice(at + AVATAR_PREFIX.length)}`;
}
