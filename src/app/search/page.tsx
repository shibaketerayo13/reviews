import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { existingKeys, getTitleStats } from "@/lib/catalog";
import { searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { TitleGrid } from "@/components/TitleCard";
import { TmdbResults } from "@/components/TmdbResults";
import type { Title } from "@/lib/types";

export const metadata = { title: "Поиск · reviews" };

/** Убираем символы, которые ломают фильтр PostgREST, и экранируем шаблоны LIKE. */
function toIlikePattern(q: string): string {
  const cleaned = q.replace(/[,()*"\\]/g, " ").replace(/[%_]/g, (m) => `\\${m}`);
  return `%${cleaned.trim()}%`;
}

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
      <section>
        <h1>Поиск</h1>
        <form action="/search" className="inline-form">
          <input name="q" type="search" placeholder="Название фильма или сериала" autoFocus />
          <button type="submit">Искать</button>
        </form>
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

      <h1>Поиск: «{q}»</h1>

      <section>
        <h2>В каталоге</h2>
        {titles.length > 0 ? (
          <TitleGrid titles={titles} stats={stats} />
        ) : (
          <p className="muted">В каталоге ничего не нашлось.</p>
        )}
      </section>

      <section>
        <h2>Ещё в TMDB</h2>
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
