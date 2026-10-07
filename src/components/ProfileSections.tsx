import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { STATUS_LABEL, WATCH_STATUSES } from "@/lib/types";
import type { Entry, Tab } from "@/lib/profile-data";

export function ProfileStats({
  counts,
  avg,
}: {
  counts: Record<Tab, number>;
  avg: string;
}) {
  return (
    <dl className="profile-stats">
      <div>
        <dt>Просмотрено</dt>
        <dd>{counts.watched}</dd>
      </div>
      <div>
        <dt>В планах</dt>
        <dd>{counts.planned}</dd>
      </div>
      <div>
        <dt>Брошено</dt>
        <dd>{counts.dropped}</dd>
      </div>
      <div>
        <dt>Средняя оценка</dt>
        <dd className="accent">{avg}</dd>
      </div>
    </dl>
  );
}

export function FavoritesRow({
  favorites,
  emptyHint,
}: {
  favorites: Entry[];
  emptyHint: string | null;
}) {
  if (favorites.length === 0 && !emptyHint) return null;
  return (
    <section className="favorites">
      <div className="section-head">
        <h2>
          Любимые <span className="fav-heart" aria-hidden="true">♥</span>
        </h2>
        {favorites.length > 0 && <span className="section-count">{favorites.length}</span>}
      </div>
      {favorites.length === 0 ? (
        <p className="muted small-text">{emptyHint}</p>
      ) : (
        <ul className="fav-grid">
          {favorites.map((e, i) => {
            const t = e.titles!;
            const poster = posterUrl(t.poster_path, "w342");
            return (
              <li
                key={t.id}
                className="reveal"
                style={{ "--i": Math.min(i, 16) } as React.CSSProperties}
              >
                <Link href={`/title/${t.id}`} className="fav-tile" title={t.title}>
                  {poster ? (
                    <Image src={poster} alt={t.title} fill sizes="(max-width: 640px) 30vw, 140px" />
                  ) : (
                    <span className="no-poster">{t.title}</span>
                  )}
                  <span className="fav-caption">
                    <span className="fav-title">{t.title}</span>
                    {e.score !== null && <span className="fav-score">{e.score}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProfileTabsNav({
  basePath,
  tab,
  counts,
}: {
  basePath: string;
  tab: Tab;
  counts: Record<Tab, number>;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Все" },
    ...WATCH_STATUSES.map((s) => ({ key: s as Tab, label: STATUS_LABEL[s] })),
  ];
  return (
    <nav className="tabs-list" aria-label="Разделы профиля">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === "all" ? basePath : `${basePath}?tab=${t.key}`}
          className={`tab${tab === t.key ? " active" : ""}`}
          aria-current={tab === t.key ? "page" : undefined}
          scroll={false}
        >
          {t.label}
          <span className="tab-count">{counts[t.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
