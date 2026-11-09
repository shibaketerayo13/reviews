// Названия и описания фильмов на выбранном языке.
// В базе основной язык — русский (titles.title / overview), переводы лежат в titles.translations.
import type { Locale } from "./config";

export type TranslationLang = "be" | "pl" | "en";
export type TitleTranslations = Partial<Record<TranslationLang, { title?: string; overview?: string }>>;

type Localizable = {
  title: string;
  original_title?: string | null;
  overview?: string | null;
  translations?: TitleTranslations | null;
};

/** Откуда брать текст, если на нужном языке его нет: польскому подойдёт английский. */
const CHAIN: Record<Locale, TranslationLang[]> = {
  ru: [],
  be: ["be"],
  pl: ["pl", "en"],
  en: ["en"],
};

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u;

export function localTitle(t: Localizable, locale: Locale): string {
  for (const lang of CHAIN[locale]) {
    const value = t.translations?.[lang]?.title;
    if (value) return value;
  }
  // Для латиницы оригинальное название понятнее русского
  if ((locale === "en" || locale === "pl") && t.original_title && LATIN.test(t.original_title)) {
    return t.original_title;
  }
  return t.title;
}

export function localOverview(t: Localizable, locale: Locale): string | null {
  for (const lang of CHAIN[locale]) {
    const value = t.translations?.[lang]?.overview;
    if (value) return value;
  }
  return t.overview ?? null;
}

/** Есть ли перевод названия именно на этот язык (без запасных вариантов). */
export function hasTranslation(t: Localizable, locale: Locale): boolean {
  return locale === "ru" || CHAIN[locale].some((lang) => Boolean(t.translations?.[lang]?.title));
}
