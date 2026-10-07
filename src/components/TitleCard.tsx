import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf, type Title, type TitleStat } from "@/lib/types";

export function TitleCard({
  title,
  stat,
  index = 0,
}: {
  title: Title;
  stat?: TitleStat;
  index?: number;
}) {
  const poster = posterUrl(title.poster_path, "w342");
  return (
    <Link
      href={`/title/${title.id}`}
      className="card reveal"
      style={{ "--i": Math.min(index, 18) } as React.CSSProperties}
    >
      <div className="card-poster">
        {poster ? (
          <Image
            src={poster}
            alt={title.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1100px) 22vw, 180px"
          />
        ) : (
          <div className="no-poster">{title.title}</div>
        )}
        {stat && (
          <span className="card-score" title={`Оценок на сайте: ${stat.count}`}>
            ★ {stat.avg.toFixed(1)}
          </span>
        )}
      </div>
      <div className="card-body">
        <h3>{title.title}</h3>
        <p>
          {MEDIA_LABEL[title.media_type]}
          {title.release_date && ` · ${yearOf(title.release_date)}`}
        </p>
      </div>
    </Link>
  );
}

export function TitleGrid({
  titles,
  stats,
}: {
  titles: Title[];
  stats: Map<number, TitleStat>;
}) {
  return (
    <div className="grid">
      {titles.map((t, i) => (
        <TitleCard key={t.id} title={t} stat={stats.get(t.id)} index={i} />
      ))}
    </div>
  );
}
