"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DECADES,
  SORTS,
  TYPES,
  catalogHref,
  decadeLabel,
  type CatalogParams,
  type Decade,
  type Sort,
  type TypeFilter,
} from "@/lib/catalog-params";
import { plural } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";

/**
 * Панель фильтров каталога и область результатов.
 * Пока грузится новая выборка, старые карточки плавно приглушаются.
 */
export function CatalogShell({
  params,
  total,
  children,
}: {
  params: CatalogParams;
  total: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  function update(next: Partial<CatalogParams>) {
    // Любая смена фильтра возвращает на первую страницу
    startTransition(() => {
      router.push(catalogHref({ ...params, page: 1, ...next }), { scroll: false });
    });
  }

  return (
    <>
      <div className="catalog-bar">
        <div className="segmented" role="radiogroup" aria-label={t.catalog.typeAria}>
          {TYPES.map((type: TypeFilter) => (
            <label key={type}>
              <input
                type="radio"
                name="type"
                checked={params.type === type}
                onChange={() => update({ type })}
              />
              <span>{t.catalog.types[type]}</span>
            </label>
          ))}
        </div>

        <div className="catalog-selects">
          <label className="pill-select">
            <span className="visually-hidden">{t.catalog.yearsAria}</span>
            <select
              value={params.decade}
              onChange={(e) => update({ decade: e.target.value as Decade })}
            >
              {DECADES.map((d) => (
                <option key={d} value={d}>
                  {decadeLabel(d, t.catalog)}
                </option>
              ))}
            </select>
          </label>

          <label className="pill-select">
            <span className="pill-select-label">{t.catalog.sortLabel}</span>
            <select
              value={params.sort}
              onChange={(e) => update({ sort: e.target.value as Sort })}
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.catalog.sorts[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <span className="catalog-total" aria-live="polite">
          {pending ? t.common.loading : plural(locale, total, t.plural.items)}
        </span>
      </div>

      <div className={`catalog-results${pending ? " is-pending" : ""}`} aria-busy={pending}>
        {children}
      </div>
    </>
  );
}
