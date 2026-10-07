import Image from "next/image";
import { posterUrl, searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf } from "@/lib/types";
import { replaceTitle } from "@/app/admin/actions";

/** Только для админа: заменить карточку фильма на правильную из TMDB. */
export async function AdminFix({
  titleId,
  currentTmdbId,
  defaultQuery,
  query,
}: {
  titleId: number;
  currentTmdbId: number;
  defaultQuery: string;
  query?: string;
}) {
  let results: TmdbSearchItem[] = [];
  let error: string | null = null;
  if (query) {
    try {
      results = (await searchMovieTv(query)).filter((r) => r.id !== currentTmdbId);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <details className="admin-fix" open={Boolean(query)}>
      <summary>Неверный фильм? Заменить (админ)</summary>
      <p className="muted small-text">
        Найдите правильный фильм в TMDB. Карточка перепривяжется к нему, а оценки,
        отзывы и «любимые» пользователей сохранятся.
      </p>
      <form className="inline-form" action={`/title/${titleId}#fix`}>
        <input name="fix" defaultValue={query ?? defaultQuery} aria-label="Название для поиска" />
        <button type="submit" className="button button-small button-ghost">
          Найти в TMDB
        </button>
      </form>

      {error && <p className="notice error">{error}</p>}
      {query && !error && results.length === 0 && (
        <p className="muted small-text">Ничего не найдено. Попробуйте английское название.</p>
      )}
      {results.length > 0 && (
        <ul className="tmdb-list" id="fix">
          {results.map((r) => {
            const name = r.title ?? r.name ?? "Без названия";
            const original = r.original_title ?? r.original_name;
            const poster = posterUrl(r.poster_path, "w154");
            return (
              <li key={`${r.media_type}:${r.id}`} className="tmdb-item">
                {poster ? (
                  <Image src={poster} alt="" width={46} height={69} />
                ) : (
                  <div className="no-poster small" />
                )}
                <div className="tmdb-info">
                  <strong>{name}</strong>
                  <span className="muted small-text">
                    {MEDIA_LABEL[r.media_type]} {yearOf(r.release_date ?? r.first_air_date)}
                    {original && original !== name ? ` · ${original}` : ""}
                  </span>
                  {r.overview && <span className="fix-overview">{r.overview}</span>}
                </div>
                <form action={replaceTitle}>
                  <input type="hidden" name="title_id" value={titleId} />
                  <input type="hidden" name="tmdb_id" value={r.id} />
                  <input type="hidden" name="media_type" value={r.media_type} />
                  <button type="submit" className="button button-small">
                    Заменить на этот
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
