import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** «Фильм · 2010 · 2 ч 28 мин · фантастика, боевик» */
export function metaLine({
  typeLabel,
  year,
  runtime,
  seasons,
  genres,
}: {
  typeLabel: string;
  year: string;
  runtime: number | null;
  seasons: number | null;
  genres: string[];
}): string {
  const parts = [typeLabel];
  if (year) parts.push(year);
  if (seasons) parts.push(`${seasons} ${plural(seasons, "сезон", "сезона", "сезонов")}`);
  if (runtime) {
    const h = Math.floor(runtime / 60);
    const m = runtime % 60;
    parts.push(h ? `${h} ч${m ? ` ${m} мин` : ""}` : `${m} мин`);
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
