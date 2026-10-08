/**
 * Адрес сайта для ссылок из бота. На Vercel берётся основной домен проекта
 * (VERCEL_PROJECT_PRODUCTION_URL задаётся автоматически), иначе — адрес запроса.
 */
export function siteUrl(fallbackOrigin: string): string {
  const explicit = process.env.SITE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return fallbackOrigin.replace(/\/+$/, "");
}
