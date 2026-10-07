import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf, type Title, type TitleStat } from "@/lib/types";

export function TitleCard({ title, stat }: { title: Title; stat?: TitleStat }) {
  const poster = posterUrl(title.poster_path, "w342");
  return (
    <Link href={`/title/${title.id}`} className="card">
      {poster ? (
        <Image src={poster} alt={title.title} width={342} height={513} />
      ) : (
        <div className="no-poster">нет постера</div>
      )}
      <h3>{title.title}</h3>
      <p className="muted small-text">
        {MEDIA_LABEL[title.media_type]} {yearOf(title.release_date)}
      </p>
      <p className="rating">
        {stat ? `★ ${stat.avg.toFixed(1)} · ${stat.count}` : "нет оценок"}
      </p>
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
      {titles.map((t) => (
        <TitleCard key={t.id} title={t} stat={stats.get(t.id)} />
      ))}
    </div>
  );
}
