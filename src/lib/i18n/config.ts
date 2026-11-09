// Языки сайта. Файл общий для сервера и браузера (без серверных зависимостей).

export const LOCALES = ["ru", "be", "pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";
/** Cookie с выбранным языком (живёт год). */
export const LOCALE_COOKIE = "lang";

/** Названия языков на самих этих языках: так их проще узнать в списке. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  be: "Беларуская",
  pl: "Polski",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = { ru: "RU", be: "BE", pl: "PL", en: "EN" };

/** Локаль для дат и чисел (Intl). */
export const INTL_LOCALE: Record<Locale, string> = {
  ru: "ru-RU",
  be: "be-BY",
  pl: "pl-PL",
  en: "en-GB",
};

/**
 * Язык живых запросов к TMDB (актёры, жанры, похожие).
 * Для белорусского берём русский: беларуских данных в TMDB мало, а кириллица читается привычнее.
 * Названия и описания фильмов на беларуском берутся из сохранённых переводов, если они есть.
 */
export const TMDB_LANGUAGE: Record<Locale, string> = {
  ru: "ru-RU",
  be: "ru-RU",
  pl: "pl-PL",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Язык по заголовку Accept-Language браузера (первый подходящий из списка). */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Подстановка: fmt("Привет, {name}", { name: "Аня" }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

/** Формы для склонения по числу. «#» заменяется числом. */
export type PluralForms = { one: string; few: string; many: string; other: string };

const rulesCache = new Map<Locale, Intl.PluralRules>();

export function plural(locale: Locale, n: number, forms: PluralForms): string {
  let rules = rulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[locale]);
    rulesCache.set(locale, rules);
  }
  const cat = rules.select(n) as keyof PluralForms;
  const form = forms[cat] ?? forms.other;
  return form.replace("#", n.toLocaleString(INTL_LOCALE[locale]));
}

export function formatDate(locale: Locale, iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" });
}

export function formatNumber(locale: Locale, n: number): string {
  return n.toLocaleString(INTL_LOCALE[locale]);
}
