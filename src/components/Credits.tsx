import Link from "next/link";
import { posterUrl, type Person } from "@/lib/tmdb";
import { Avatar } from "./Avatar";

/** Режиссёр или создатели одной строкой и лента актёров с фото. */
export function Credits({
  makersLabel,
  makers,
  cast,
}: {
  makersLabel: string;
  makers: Person[];
  cast: Person[];
}) {
  if (makers.length === 0 && cast.length === 0) return null;

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
            <h2>В ролях</h2>
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
