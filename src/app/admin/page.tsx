import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { existingKeys } from "@/lib/catalog";
import { searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { TmdbResults } from "@/components/TmdbResults";
import { MEDIA_LABEL, yearOf, type Title } from "@/lib/types";
import { deleteTitle, importList, refreshTitle } from "./actions";

export const metadata = { title: "Админка · reviews" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { q: rawQ = "", error, message } = await searchParams;
  const q = rawQ.trim().slice(0, 100);

  const supabase = await createClient();
  const [{ count: total }, { data: recent }] = await Promise.all([
    supabase.from("titles").select("id", { count: "exact", head: true }),
    supabase
      .from("titles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let results: TmdbSearchItem[] = [];
  let inCatalog = new Set<string>();
  let searchError: string | null = null;
  if (q) {
    try {
      results = await searchMovieTv(q);
      inCatalog = await existingKeys(results);
    } catch (e) {
      searchError = e instanceof Error ? e.message : String(e);
    }
  }
  const missing = results.filter((r) => !inCatalog.has(`${r.media_type}:${r.id}`));
  const alreadyCount = results.length - missing.length;

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <h1>Админка</h1>
      <p className="muted">В каталоге: {total ?? 0}</p>

      <section className="panel">
        <h2>Докачать из TMDB</h2>
        <form action="/admin" className="inline-form">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Название фильма или сериала"
          />
          <button type="submit">Найти в TMDB</button>
        </form>
        {searchError && <p className="notice error">{searchError}</p>}
        {q && !searchError && (
          <>
            {alreadyCount > 0 && (
              <p className="muted small-text">
                Уже в каталоге: {alreadyCount}
              </p>
            )}
            {missing.length > 0 ? (
              <TmdbResults
                items={missing}
                isAdmin
                returnTo={`/admin?q=${encodeURIComponent(q)}`}
              />
            ) : (
              <p className="muted">Нечего добавлять.</p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Быстрый импорт</h2>
        <p className="muted small-text">
          Добавляет 20 штук за раз, повторы пропускаются.
        </p>
        <div className="button-row">
          {(
            [
              ["movie", "popular", "Популярные фильмы"],
              ["tv", "popular", "Популярные сериалы"],
              ["movie", "trending", "Фильмы недели"],
              ["tv", "trending", "Сериалы недели"],
            ] as const
          ).map(([type, source, label]) => (
            <form action={importList} key={`${type}-${source}`}>
              <input type="hidden" name="media_type" value={type} />
              <input type="hidden" name="source" value={source} />
              <button type="submit">{label}</button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2>Последние добавленные</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Год</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {((recent ?? []) as Title[]).map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/title/${t.id}`}>{t.title}</Link>
                </td>
                <td>{MEDIA_LABEL[t.media_type]}</td>
                <td>{yearOf(t.release_date)}</td>
                <td className="actions">
                  <form action={refreshTitle}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="link-button">
                      Обновить
                    </button>
                  </form>
                  <form action={deleteTitle}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="link-button danger">
                      Удалить
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
