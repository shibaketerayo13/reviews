import Image from "next/image";
import Link from "next/link";
import { posterUrl, type TmdbSearchItem } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf } from "@/lib/types";

/** Карточка тайтла из TMDB: ведёт в каталог, если он там есть, иначе на превью. */
export function TmdbCard({
  item,
  href,
  inCatalog,
  subtitle,
  index = 0,
}: {
  item: TmdbSearchItem;
  href: string;
  inCatalog: boolean;
  subtitle?: string;
  index?: number;
}) {
  const name = item.title ?? item.name ?? "Без названия";
  const poster = posterUrl(item.poster_path, "w342");
  const year = yearOf(item.release_date ?? item.first_air_date);
  return (
    <Link
      href={href}
      className={`card reveal${inCatalog ? "" : " is-external"}`}
      style={{ "--i": Math.min(index, 14) } as React.CSSProperties}
    >
      <div className="card-poster">
        {poster ? (
          <Image src={poster} alt={name} fill sizes="(max-width: 640px) 40vw, 180px" />
        ) : (
          <div className="no-poster">{name}</div>
        )}
        {!inCatalog && <span className="card-flag">не в каталоге</span>}
      </div>
      <div className="card-body">
        <h3>{name}</h3>
        <p>{subtitle ?? `${MEDIA_LABEL[item.media_type]}${year ? ` · ${year}` : ""}`}</p>
      </div>
    </Link>
  );
}
