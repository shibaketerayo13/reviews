import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { existingKeys, getTitleStats } from "@/lib/catalog";
import { searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { TitleGrid } from "@/components/TitleCard";
import { TmdbResults } from "@/components/TmdbResults";
import type { Title } from "@/lib/types";
import { toIlikePattern } from "@/lib/search";

export const metadata = { title: "Поиск · reviews" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; message?: string }>;
}) {
  const { q: rawQ = "", error, message } = await searchParams;
  const q = rawQ.trim().slice(0, 100);
  const profile = await getProfile();
  const isAdmin = Boolean(profile?.is_admin);

  if (!q) {
    return (
      <section className="page-head reveal">
        <p className="eyebrow">Поиск</p>
        <h1>Что ищем?</h1>
        <p className="lead">
          Начните вводить название в строке поиска наверху: подсказки появятся
          сразу.
        </p>
      </section>
    );
  }

  const supabase = await createClient();
  const pattern = toIlikePattern(q);
  const { data: local } = await supabase
    .from("titles")
    .select("*")
    .or(`title.ilike.${pattern},original_title.ilike.${pattern}`)
    .order("tmdb_rating", { ascending: false, nullsFirst: false })
    .limit(48);
  const titles = (local ?? []) as Title[];
  const stats = await getTitleStats(titles.map((t) => t.id));

  // Дополнительно ищем в TMDB то, чего нет в каталоге
  let tmdbMissing: TmdbSearchItem[] = [];
  let tmdbError: string | null = null;
  try {
    const found = await searchMovieTv(q);
    const have = await existingKeys(found);
    tmdbMissing = found.filter((i) => !have.has(`${i.media_type}:${i.id}`));
  } catch (e) {
    tmdbError = e instanceof Error ? e.message : String(e);
  }

  const returnTo = `/search?q=${encodeURIComponent(q)}`;

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <header className="page-head reveal">
        <p className="eyebrow">Поиск</p>
        <h1>«{q}»</h1>
      </header>

      <section>
        <div className="section-head">
          <h2>В каталоге</h2>
          <span className="section-count">{titles.length}</span>
        </div>
        {titles.length > 0 ? (
          <TitleGrid titles={titles} stats={stats} />
        ) : (
          <p className="muted">В каталоге ничего не нашлось.</p>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Ещё в TMDB</h2>
        </div>
        {tmdbError ? (
          <p className="notice error">Поиск в TMDB недоступен: {tmdbError}</p>
        ) : tmdbMissing.length > 0 ? (
          <>
            {!isAdmin && (
              <p className="muted small-text">
                Этих фильмов пока нет в каталоге, их может добавить администратор.
              </p>
            )}
            <TmdbResults items={tmdbMissing} isAdmin={isAdmin} returnTo={returnTo} />
          </>
        ) : (
          <p className="muted">Всё найденное в TMDB уже есть в каталоге.</p>
        )}
      </section>
    </>
  );
}
