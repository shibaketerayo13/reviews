// Превью фильма или сериала, которого ещё нет в каталоге сайта.
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { catalogIdMap } from "@/lib/catalog";
import { getFullDetails, isMediaType } from "@/lib/tmdb";
import { Credits } from "@/components/Credits";
import { Related } from "@/components/Related";
import { TitleHero, metaLine } from "@/components/TitleHero";
import { yearOf } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { TMDB_LANGUAGE } from "@/lib/i18n/config";
import { addTitle } from "@/app/admin/actions";

export default async function TmdbPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { type, id: rawId } = await params;
  const { error } = await searchParams;
  const tmdbId = Number(rawId);
  if (!isMediaType(type) || !Number.isInteger(tmdbId) || tmdbId <= 0) notFound();

  // Если тайтл уже в каталоге, ведём на полноценную страницу
  const ids = await catalogIdMap([{ id: tmdbId, media_type: type }]);
  const local = ids.get(`${type}:${tmdbId}`);
  if (local) redirect(`/title/${local}`);

  const { locale, t } = await getI18n();
  const details = await getFullDetails(type, tmdbId, TMDB_LANGUAGE[locale]).catch(() => null);
  if (!details) notFound();

  const profile = await getProfile();
  const m = details.media;
  const name = m.title ?? m.name ?? t.common.untitled;
  const meta = metaLine({
    locale,
    t,
    typeLabel: t.media[type],
    year: yearOf(m.release_date ?? m.first_air_date),
    runtime: details.runtime,
    seasons: details.seasons,
    genres: details.genres,
  });

  return (
    <div className="title-page">
      {error && <p className="notice error">{error}</p>}

      <TitleHero
        posterPath={m.poster_path}
        backdropPath={m.backdrop_path}
        name={name}
        original={m.original_title ?? m.original_name ?? null}
        meta={meta}
        overview={m.overview || null}
      >
        {m.vote_average ? (
          <dl className="scores reveal" style={{ "--i": 4 } as React.CSSProperties}>
            <div>
              <dt>TMDB</dt>
              <dd>
                <span className="score-big">{m.vote_average.toFixed(1)}</span>
              </dd>
            </div>
          </dl>
        ) : null}
      </TitleHero>

      <div className="title-layout">
        <div className="title-main">
          <Credits makersRole={details.makersRole} makers={details.makers} cast={details.cast} />
        </div>
        <aside className="title-aside reveal" style={{ "--i": 6 } as React.CSSProperties}>
          <section className="entry-card">
            <header className="entry-card-head">
              <h2>{t.title.notInCatalogTitle}</h2>
            </header>
            <p className="muted small-text">
              {type === "movie" ? t.title.notInCatalogMovie : t.title.notInCatalogTv}
            </p>
            {profile?.is_admin && (
              <form action={addTitle}>
                <input type="hidden" name="tmdb_id" value={tmdbId} />
                <input type="hidden" name="media_type" value={type} />
                <input type="hidden" name="return_to" value={`/tmdb/${type}/${tmdbId}`} />
                <button type="submit" className="button button-block">
                  {t.card.addToCatalog}
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>

      <Related items={details.related} />
    </div>
  );
}
