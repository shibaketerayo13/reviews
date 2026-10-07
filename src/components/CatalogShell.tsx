"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DECADES,
  SORTS,
  TYPES,
  catalogHref,
  type CatalogParams,
  type Decade,
  type Sort,
  type TypeFilter,
} from "@/lib/catalog-params";

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
        <div className="segmented" role="radiogroup" aria-label="Тип">
          {(Object.keys(TYPES) as TypeFilter[]).map((t) => (
            <label key={t}>
              <input
                type="radio"
                name="type"
                checked={params.type === t}
                onChange={() => update({ type: t })}
              />
              <span>{TYPES[t]}</span>
            </label>
          ))}
        </div>

        <div className="catalog-selects">
          <label className="pill-select">
            <span className="visually-hidden">Годы</span>
            <select
              value={params.decade}
              onChange={(e) => update({ decade: e.target.value as Decade })}
            >
              {(Object.keys(DECADES) as Decade[]).map((d) => (
                <option key={d} value={d}>
                  {DECADES[d]}
                </option>
              ))}
            </select>
          </label>

          <label className="pill-select">
            <span className="pill-select-label">Сортировка</span>
            <select
              value={params.sort}
              onChange={(e) => update({ sort: e.target.value as Sort })}
            >
              {(Object.keys(SORTS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORTS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <span className="catalog-total" aria-live="polite">
          {pending ? "Загрузка…" : `${total.toLocaleString("ru-RU")} шт.`}
        </span>
      </div>

      <div className={`catalog-results${pending ? " is-pending" : ""}`} aria-busy={pending}>
        {children}
      </div>
    </>
  );
}
