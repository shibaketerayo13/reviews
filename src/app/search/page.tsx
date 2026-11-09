import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { existingKeys, getTitleStats } from "@/lib/catalog";
import { searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { TitleGrid } from "@/components/TitleCard";
import { TmdbResults } from "@/components/TmdbResults";
import type { Title } from "@/lib/types";
import { searchTitles } from "@/lib/title-search";
import { searchUsers } from "@/lib/users";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { TMDB_LANGUAGE, fmt } from "@/lib/i18n/config";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.meta.search} · reviews` };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; message?: string }>;
}) {
  const { q: rawQ = "", error, message } = await searchParams;
  const q = rawQ.trim().slice(0, 100);
  const profile = await getProfile();
  const isAdmin = Boolean(profile?.is_admin);
  const { locale, t } = await getI18n();

  if (!q) {
    return (
      <section className="page-head reveal">
        <p className="eyebrow">{t.search.eyebrow}</p>
        <h1>{t.search.emptyTitle}</h1>
        <p className="lead">{t.search.emptyLead}</p>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: titles } = await searchTitles<Title>(supabase, q, "*", 48);
  const [stats, people] = await Promise.all([
    getTitleStats(titles.map((t) => t.id)),
    searchUsers(q, 12).catch(() => []),
  ]);

  // Дополнительно ищем в TMDB то, чего нет в каталоге
  let tmdbMissing: TmdbSearchItem[] = [];
  let tmdbError: string | null = null;
  try {
    const found = await searchMovieTv(q, TMDB_LANGUAGE[locale]);
    const have = await existingKeys(found);
    tmdbMissing = found.filter((i) => !have.has(`${i.media_type}:${i.id}`));
  } catch (e) {
    tmdbError = e instanceof Error ? e.message : String(e);
  }

  const returnTo = `/search?q=${encodeURIComponent(q)}`;

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <header className="page-head reveal">
        <p className="eyebrow">{t.search.eyebrow}</p>
        <h1>«{q}»</h1>
      </header>

      {people.length > 0 && (
        <section>
          <div className="section-head">
            <h2>{t.search.people}</h2>
            <span className="section-count">{people.length}</span>
          </div>
          <ul className="people-list">
            {people.map((u, i) => {
              const name = u.display_name ?? u.username;
              return (
                <li key={u.username} className="reveal" style={{ "--i": i } as React.CSSProperties}>
                  <Link href={`/u/${u.username}`} className="person-chip">
                    <Avatar url={u.avatar_url} name={name} size={44} />
                    <span>
                      <strong>{name}</strong>
                      <span className="muted small-text">@{u.username}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>{t.search.inCatalog}</h2>
          <span className="section-count">{titles.length}</span>
        </div>
        {titles.length > 0 ? (
          <TitleGrid titles={titles} stats={stats} />
        ) : (
          <p className="muted">{t.search.nothingInCatalog}</p>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>{t.search.moreInTmdb}</h2>
        </div>
        {tmdbError ? (
          <p className="notice error">{fmt(t.search.tmdbUnavailable, { error: tmdbError })}</p>
        ) : tmdbMissing.length > 0 ? (
          <>
            {!isAdmin && (
              <p className="muted small-text">{t.search.notInCatalogHint}</p>
            )}
            <TmdbResults items={tmdbMissing} isAdmin={isAdmin} returnTo={returnTo} />
          </>
        ) : (
          <p className="muted">{t.search.allInCatalog}</p>
        )}
      </section>
    </>
  );
}
