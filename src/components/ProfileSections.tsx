import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { WATCH_STATUSES } from "@/lib/types";
import type { Entry, Tab } from "@/lib/profile-data";
import { getI18n } from "@/lib/i18n/server";
import { localTitle } from "@/lib/i18n/content";

export async function ProfileStats({
  counts,
  avg,
}: {
  counts: Record<Tab, number>;
  avg: string;
}) {
  const { t } = await getI18n();
  return (
    <dl className="profile-stats">
      <div>
        <dt>{t.profile.stats.watched}</dt>
        <dd>{counts.watched}</dd>
      </div>
      <div>
        <dt>{t.profile.stats.planned}</dt>
        <dd>{counts.planned}</dd>
      </div>
      <div>
        <dt>{t.profile.stats.dropped}</dt>
        <dd>{counts.dropped}</dd>
      </div>
      <div>
        <dt>{t.profile.stats.avg}</dt>
        <dd className="accent">{avg}</dd>
      </div>
    </dl>
  );
}

export async function FavoritesRow({
  favorites,
  emptyHint,
}: {
  favorites: Entry[];
  emptyHint: string | null;
}) {
  if (favorites.length === 0 && !emptyHint) return null;
  const { locale, t: dict } = await getI18n();
  return (
    <section className="favorites">
      <div className="section-head">
        <h2>
          {dict.profile.favorites} <span className="fav-heart" aria-hidden="true">♥</span>
        </h2>
        {favorites.length > 0 && <span className="section-count">{favorites.length}</span>}
      </div>
      {favorites.length === 0 ? (
        <p className="muted small-text">{emptyHint}</p>
      ) : (
        <ul className="fav-grid">
          {favorites.map((e, i) => {
            const t = e.titles!;
            const name = localTitle(t, locale);
            const poster = posterUrl(t.poster_path, "w342");
            return (
              <li
                key={t.id}
                className="reveal"
                style={{ "--i": Math.min(i, 16) } as React.CSSProperties}
              >
                <Link href={`/title/${t.id}`} className="fav-tile" title={name}>
                  {poster ? (
                    <Image src={poster} alt={name} fill sizes="(max-width: 640px) 30vw, 140px" />
                  ) : (
                    <span className="no-poster">{name}</span>
                  )}
                  <span className="fav-caption">
                    <span className="fav-title">{name}</span>
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

export async function ProfileTabsNav({
  basePath,
  tab,
  counts,
}: {
  basePath: string;
  tab: Tab;
  counts: Record<Tab, number>;
}) {
  const { t: dict } = await getI18n();
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: dict.profile.tabAll },
    ...WATCH_STATUSES.map((s) => ({ key: s as Tab, label: dict.status[s] })),
  ];
  return (
    <nav className="tabs-list" aria-label={dict.profile.tabsAria}>
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
