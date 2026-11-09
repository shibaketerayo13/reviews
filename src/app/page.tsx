import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth";
import { getTitleStats } from "@/lib/catalog";
import { TitleGrid } from "@/components/TitleCard";
import { posterUrl } from "@/lib/tmdb";
import { yearOf, type Title } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { localTitle } from "@/lib/i18n/content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { locale, t } = await getI18n();

  const { data: latest, error } = await supabase
    .from("titles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(18);

  if (error) {
    return (
      <section className="panel">
        <h2>{t.home.dbTitle}</h2>
        <p>{t.home.dbText.replace("{file}", "supabase/schema.sql")}</p>
        <p className="muted small-text">{error.message}</p>
      </section>
    );
  }

  const titles = (latest ?? []) as Title[];

  if (titles.length === 0) {
    const profile = await getProfile();
    return (
      <section className="page-head reveal">
        <p className="eyebrow">{t.home.emptyEyebrow}</p>
        <h1>{t.home.emptyTitle}</h1>
        {profile?.is_admin ? (
          <p className="lead">
            <Link href="/admin">{t.home.emptyAdmin}</Link>
          </p>
        ) : (
          <p className="lead">{t.home.emptyUser}</p>
        )}
      </section>
    );
  }

  // Герой: случайный фильм из десятка лучших по рейтингу TMDB, у которого есть кадр
  const [{ data: featuredPool }, { data: top }, user] = await Promise.all([
    supabase
      .from("titles")
      .select("*")
      .not("backdrop_path", "is", null)
      .order("tmdb_rating", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("title_stats")
      .select("title_id")
      .gte("ratings_count", 1)
      .order("avg_score", { ascending: false })
      .order("ratings_count", { ascending: false })
      .limit(12),
    getUser(),
  ]);
  const pool = (featuredPool ?? []) as Title[];
  const featured = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;

  const topIds = (top ?? []).map((r) => r.title_id as number);
  const { data: topRows } = topIds.length
    ? await supabase.from("titles").select("*").in("id", topIds)
    : { data: [] };
  const topTitles = topIds
    .map((id) => (topRows as Title[]).find((t) => t.id === id))
    .filter((t): t is Title => Boolean(t));

  const stats = await getTitleStats([...titles.map((t) => t.id), ...topIds]);
  const backdrop = featured ? posterUrl(featured.backdrop_path, "w1280") : null;

  return (
    <>
      <section className="hero">
        {backdrop && (
          <div className="hero-backdrop" aria-hidden="true">
            <Image src={backdrop} alt="" fill priority sizes="100vw" />
          </div>
        )}
        <div className="hero-content">
          <p className="eyebrow reveal" style={{ "--i": 0 } as React.CSSProperties}>
            {t.home.eyebrow}
          </p>
          <h1 className="hero-title reveal" style={{ "--i": 1 } as React.CSSProperties}>
            {t.home.titleStart}
            <em>{t.home.titleAccent}</em>
          </h1>
          <p className="lead reveal" style={{ "--i": 2 } as React.CSSProperties}>
            {t.home.lead}
          </p>
          <div className="hero-actions reveal" style={{ "--i": 3 } as React.CSSProperties}>
            {user ? (
              <Link href="/profile" className="button">
                {t.home.myProfile}
              </Link>
            ) : (
              <Link href="/login" className="button">
                {t.home.createAccount}
              </Link>
            )}
            <Link href="/catalog" className="button button-ghost">
              {t.home.browseCatalog}
            </Link>
          </div>
        </div>
        {featured && (
          <Link
            href={`/title/${featured.id}`}
            className="hero-caption reveal"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            <span className="muted">{t.home.inFrame}</span> {localTitle(featured, locale)}
            <span className="muted">
              {" "}
              · {t.media[featured.media_type]} {yearOf(featured.release_date)}
            </span>
          </Link>
        )}
      </section>

      {topTitles.length > 0 && (
        <section>
          <div className="section-head">
            <h2>{t.home.top}</h2>
            <span className="section-note">{t.home.topNote}</span>
          </div>
          <TitleGrid titles={topTitles} stats={stats} />
        </section>
      )}

      <section id="catalog">
        <div className="section-head">
          <h2>{t.home.latest}</h2>
          <Link href="/catalog?sort=added" className="section-link">
            {t.home.allCatalog}
          </Link>
        </div>
        <TitleGrid titles={titles} stats={stats} />
      </section>
    </>
  );
}
