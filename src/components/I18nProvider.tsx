"use client";

// Язык и словарь для клиентских компонентов. Данные приходят из корневого layout.
import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ru";

const I18nContext = createContext<{ locale: Locale; t: Dict } | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t: dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): { locale: Locale; t: Dict } {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n: нет I18nProvider выше по дереву");
  return value;
}
