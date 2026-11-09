import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { fmt, plural, type Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n";

/** «Фильм · 2010 · 2 ч 28 мин · фантастика, боевик» */
export function metaLine({
  locale,
  t,
  typeLabel,
  year,
  runtime,
  seasons,
  genres,
}: {
  locale: Locale;
  t: Dict;
  typeLabel: string;
  year: string;
  runtime: number | null;
  seasons: number | null;
  genres: string[];
}): string {
  const parts = [typeLabel];
  if (year) parts.push(year);
  if (seasons) parts.push(plural(locale, seasons, t.plural.seasons));
  if (runtime) {
    const h = Math.floor(runtime / 60);
    const m = runtime % 60;
    const hours = fmt(t.title.hours, { h });
    const minutes = fmt(t.title.minutes, { m });
    parts.push(h ? (m ? `${hours} ${minutes}` : hours) : minutes);
  }
  if (genres.length) parts.push(genres.slice(0, 3).join(", ").toLowerCase());
  return parts.join(" · ");
}

/** Шапка страницы тайтла: кадр на фоне, постер, название, рейтинги, описание. */
export function TitleHero({
  posterPath,
  backdropPath,
  name,
  original,
  meta,
  overview,
  children,
}: {
  posterPath: string | null;
  backdropPath: string | null;
  name: string;
  original: string | null;
  meta: string;
  overview: string | null;
  children?: React.ReactNode;
}) {
  const poster = posterUrl(posterPath, "w500");
  const backdrop = posterUrl(backdropPath, "w1280");
  return (
    <>
      {backdrop && (
        <div className="title-backdrop" aria-hidden="true">
          <Image src={backdrop} alt="" fill priority sizes="100vw" />
        </div>
      )}
      <section className="title-hero">
        <div className="title-poster reveal">
          {poster ? (
            <Image src={poster} alt={name} fill sizes="(max-width: 640px) 60vw, 280px" priority />
          ) : (
            <div className="no-poster">{name}</div>
          )}
        </div>
        <div className="title-info">
          <p className="eyebrow reveal" style={{ "--i": 1 } as React.CSSProperties}>
            {meta}
          </p>
          <h1 className="title-name reveal" style={{ "--i": 2 } as React.CSSProperties}>
            {name}
          </h1>
          {original && original !== name && (
            <p className="title-original reveal" style={{ "--i": 3 } as React.CSSProperties}>
              {original}
            </p>
          )}
          {children}
          {overview && (
            <p className="title-overview reveal" style={{ "--i": 5 } as React.CSSProperties}>
              {overview}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
