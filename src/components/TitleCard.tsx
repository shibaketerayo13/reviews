import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { yearOf, type Title, type TitleStat } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { localTitle } from "@/lib/i18n/content";
import { fmt } from "@/lib/i18n/config";

export function TitleCard({
  title,
  name,
  typeLabel,
  statLabel,
  stat,
  index = 0,
}: {
  title: Title;
  /** Название на выбранном языке */
  name: string;
  typeLabel: string;
  /** Шаблон подсказки «Оценок на сайте: {n}» */
  statLabel: string;
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
            alt={name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1100px) 22vw, 180px"
          />
        ) : (
          <div className="no-poster">{name}</div>
        )}
        {stat && (
          <span className="card-score" title={fmt(statLabel, { n: stat.count })}>
            ★ {stat.avg.toFixed(1)}
          </span>
        )}
      </div>
      <div className="card-body">
        <h3>{name}</h3>
        <p>
          {typeLabel}
          {title.release_date && ` · ${yearOf(title.release_date)}`}
        </p>
      </div>
    </Link>
  );
}

export async function TitleGrid({
  titles,
  stats,
}: {
  titles: Title[];
  stats: Map<number, TitleStat>;
}) {
  const { locale, t } = await getI18n();
  return (
    <div className="grid">
      {titles.map((title, i) => (
        <TitleCard
          key={title.id}
          title={title}
          name={localTitle(title, locale)}
          typeLabel={t.media[title.media_type]}
          statLabel={t.card.siteRatings}
          stat={stats.get(title.id)}
          index={i}
        />
      ))}
    </div>
  );
}
