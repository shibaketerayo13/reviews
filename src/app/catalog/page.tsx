import { createClient } from "@/lib/supabase/server";
import { TitleGrid } from "@/components/TitleCard";
import { CatalogShell } from "@/components/CatalogShell";
import { Pagination } from "@/components/Pagination";
import {
  DECADES,
  SORTS,
  TYPES,
  catalogHref,
  parseCatalogParams,
} from "@/lib/catalog-params";
import type { Title, TitleStat } from "@/lib/types";

export const metadata = { title: "Каталог · reviews" };
export const dynamic = "force-dynamic";

const PER_PAGE = 36;

type CatalogRow = Title & { avg_score: number | null; ratings_count: number };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = parseCatalogParams(await searchParams);
  const supabase = await createClient();

  let query = supabase.from("catalog").select("*", { count: "exact" });

  if (params.type !== "all") query = query.eq("media_type", params.type);

  if (params.decade === "old") {
    query = query.lt("release_date", "1950-01-01");
  } else if (params.decade !== "all") {
    const start = Number(params.decade);
    query = query
      .gte("release_date", `${start}-01-01`)
      .lt("release_date", `${start + 10}-01-01`);
  }

  switch (params.sort) {
    case "tmdb":
      query = query.order("tmdb_rating", { ascending: false, nullsFirst: false });
      break;
    case "site":
      query = query
        .order("avg_score", { ascending: false, nullsFirst: false })
        .order("ratings_count", { ascending: false })
        .order("tmdb_rating", { ascending: false, nullsFirst: false });
      break;
    case "year_desc":
      query = query.order("release_date", { ascending: false, nullsFirst: false });
      break;
    case "year_asc":
      query = query.order("release_date", { ascending: true, nullsFirst: false });
      break;
    case "added":
      query = query.order("created_at", { ascending: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
  }
  // Стабильный порядок при равных значениях
  query = query.order("id", { ascending: true });

  const from = (params.page - 1) * PER_PAGE;
  const { data, count, error } = await query.range(from, from + PER_PAGE - 1);

  const rows = (data ?? []) as CatalogRow[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const stats = new Map<number, TitleStat>();
  for (const r of rows) {
    if (r.avg_score !== null) {
      stats.set(r.id, { avg: Number(r.avg_score), count: Number(r.ratings_count) });
    }
  }

  const subtitle = [
    params.type !== "all" ? TYPES[params.type] : null,
    params.decade !== "all" ? DECADES[params.decade] : null,
    SORTS[params.sort].toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <header className="page-head catalog-head reveal">
        <p className="eyebrow">Каталог</p>
        <h1>
          Фильмы <em>и</em> сериалы
        </h1>
        <p className="lead">{subtitle}</p>
      </header>

      <CatalogShell params={params} total={total}>
        {error ? (
          <div className="notice error">
            Не удалось загрузить каталог. Выполните миграцию{" "}
            <code>supabase/migrations/004_catalog.sql</code> в Supabase.
            <br />
            <span className="small-text muted">{error.message}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Под эти условия ничего не нашлось</p>
            <p className="muted">Попробуйте другие годы или тип.</p>
          </div>
        ) : (
          <>
            {/* key сбрасывает анимацию появления при смене выборки */}
            <div key={`${params.type}-${params.decade}-${params.sort}-${params.page}`}>
              <TitleGrid titles={rows} stats={stats} />
            </div>
            <Pagination
              current={Math.min(params.page, lastPage)}
              last={lastPage}
              href={(page) => catalogHref({ ...params, page })}
            />
          </>
        )}
      </CatalogShell>
    </>
  );
}
