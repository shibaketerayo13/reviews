import Link from "next/link";
import { posterUrl, type Person } from "@/lib/tmdb";
import { Avatar } from "./Avatar";
import { getI18n } from "@/lib/i18n/server";

/** Режиссёр или создатели одной строкой и лента актёров с фото. */
export async function Credits({
  makersRole,
  makers,
  cast,
}: {
  makersRole: "director" | "creator";
  makers: Person[];
  cast: Person[];
}) {
  if (makers.length === 0 && cast.length === 0) return null;
  const { t } = await getI18n();
  const many = makers.length > 1;
  const makersLabel =
    makersRole === "director"
      ? many ? t.title.directors : t.title.director
      : many ? t.title.creators : t.title.creator;

  return (
    <section className="credits">
      {makers.length > 0 && (
        <div className="makers">
          <span className="makers-label">{makersLabel}</span>
          <div className="makers-list">
            {makers.map((p) => (
              <Link key={p.id} href={`/person/${p.id}`} className="maker">
                <Avatar url={posterUrl(p.profile_path, "w185")} name={p.name} size={32} />
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {cast.length > 0 && (
        <>
          <div className="section-head">
            <h2>{t.title.cast}</h2>
          </div>
          <ul className="cast-rail">
            {cast.map((p, i) => (
              <li key={p.id} className="reveal" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                <Link href={`/person/${p.id}`} className="cast-member">
                  <Avatar
                    url={posterUrl(p.profile_path, "w185")}
                    name={p.name}
                    size={84}
                    className="cast-photo"
                  />
                  <span className="cast-name">{p.name}</span>
                  {p.role && <span className="cast-role">{p.role}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
