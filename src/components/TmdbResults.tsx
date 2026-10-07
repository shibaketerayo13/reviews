import Image from "next/image";
import Link from "next/link";
import { posterUrl, type TmdbSearchItem } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf } from "@/lib/types";
import { addTitle } from "@/app/admin/actions";

/** Результаты из TMDB, которых ещё нет в каталоге. Админ может добавить их. */
export function TmdbResults({
  items,
  isAdmin,
  returnTo,
}: {
  items: TmdbSearchItem[];
  isAdmin: boolean;
  returnTo: string;
}) {
  return (
    <ul className="tmdb-list">
      {items.map((item) => {
        const name = item.title ?? item.name ?? "Без названия";
        const poster = posterUrl(item.poster_path, "w154");
        return (
          <li key={`${item.media_type}:${item.id}`} className="tmdb-item">
            {poster ? (
              <Image src={poster} alt={name} width={60} height={90} />
            ) : (
              <div className="no-poster small">—</div>
            )}
            <div className="tmdb-info">
              <Link href={`/tmdb/${item.media_type}/${item.id}`}>
                <strong>{name}</strong>
              </Link>
              <span className="muted small-text">
                {MEDIA_LABEL[item.media_type]}{" "}
                {yearOf(item.release_date ?? item.first_air_date)}
                {item.vote_average ? ` · TMDB ${item.vote_average.toFixed(1)}` : ""}
              </span>
            </div>
            {isAdmin ? (
              <form action={addTitle}>
                <input type="hidden" name="tmdb_id" value={item.id} />
                <input type="hidden" name="media_type" value={item.media_type} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit">Добавить в каталог</button>
              </form>
            ) : (
              <span className="muted small-text">нет в каталоге</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
