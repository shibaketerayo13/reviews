import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth";
import { AdminFix } from "@/components/AdminFix";
import { getTitleStats } from "@/lib/catalog";
import { getFullDetails } from "@/lib/tmdb";
import { Avatar } from "@/components/Avatar";
import { Credits } from "@/components/Credits";
import { EntryForm } from "@/components/EntryForm";
import { Related } from "@/components/Related";
import { TitleHero, metaLine } from "@/components/TitleHero";
import { yearOf, type Title, type WatchStatus } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { TMDB_LANGUAGE, formatDate, plural } from "@/lib/i18n/config";
import { hasTranslation, localOverview, localTitle } from "@/lib/i18n/content";

type ReviewRow = {
  user_id: string;
  status: WatchStatus;
  score: number | null;
  review: string | null;
  is_favorite: boolean;
  updated_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    username?: string | null;
  } | null;
};

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string; fix?: string }>;
}) {
  const { id: rawId } = await params;
  const { error, message, fix } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const { locale, t } = await getI18n();
  const { data: title } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Title>();
  if (!title) notFound();

  const [user, profile, stats, { data: reviewsData }, details] = await Promise.all([
    getUser(),
    getProfile(),
    getTitleStats([id]),
    supabase
      .from("ratings")
      .select(
        "user_id, status, score, review, is_favorite, updated_at, profiles(*)",
      )
      .eq("title_id", id)
      .order("updated_at", { ascending: false })
      .limit(100),
    // Актёры и похожие подгружаются из TMDB; если TMDB недоступен, страница всё равно работает
    getFullDetails(title.media_type, title.tmdb_id, TMDB_LANGUAGE[locale]).catch(() => null),
  ]);

  const entries = (reviewsData ?? []) as unknown as ReviewRow[];
  const mine = user ? entries.find((r) => r.user_id === user.id) : undefined;
  const reviews = entries.filter((r) => r.score !== null || r.review);
  const stat = stats.get(id);

  // Название и описание на выбранном языке: сохранённый перевод, иначе — свежие данные TMDB
  const live = details?.media;
  const liveName = live?.title ?? live?.name;
  const useLive = !hasTranslation(title, locale) && locale !== "be" && Boolean(liveName);
  const name = useLive ? liveName! : localTitle(title, locale);
  const overview = useLive && live?.overview ? live.overview : localOverview(title, locale);

  const meta = metaLine({
    locale,
    t,
    typeLabel: t.media[title.media_type],
    year: yearOf(title.release_date),
    runtime: details?.runtime ?? null,
    seasons: details?.seasons ?? null,
    genres: details?.genres ?? [],
  });

  return (
    <div className="title-page">
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <TitleHero
        posterPath={title.poster_path}
        backdropPath={title.backdrop_path}
        name={name}
        original={title.original_title}
        meta={meta}
        overview={overview}
      >
        <dl className="scores reveal" style={{ "--i": 4 } as React.CSSProperties}>
          <div>
            <dt>{t.title.siteScore}</dt>
            <dd>
              {stat ? (
                <>
                  <span className="score-big">{stat.avg.toFixed(1)}</span>
                  <span className="score-sub">{plural(locale, stat.count, t.plural.ratingsShort)}</span>
                </>
              ) : (
                <span className="score-none">—</span>
              )}
            </dd>
          </div>
          {title.tmdb_rating != null && (
            <div>
              <dt>TMDB</dt>
              <dd>
                <span className="score-big">{Number(title.tmdb_rating).toFixed(1)}</span>
              </dd>
            </div>
          )}
          {mine?.score != null && (
            <div>
              <dt>{t.title.yours}</dt>
              <dd>
                <span className="score-big accent">{mine.score}</span>
              </dd>
            </div>
          )}
        </dl>
      </TitleHero>

      <div className="title-layout">
        <div className="title-main">
          {details && (
            <Credits
              makersRole={details.makersRole}
              makers={details.makers}
              cast={details.cast}
            />
          )}

          <section>
            <div className="section-head">
              <h2>{t.title.reviews}</h2>
              <span className="section-count">{reviews.length}</span>
            </div>
            {reviews.length === 0 ? (
              <p className="muted">{t.title.noReviews}</p>
            ) : (
              <ul className="review-list">
                {reviews.map((r, i) => {
                  const author = r.profiles?.display_name ?? t.common.user;
                  const handle = r.profiles?.username;
                  return (
                    <li
                      key={r.user_id}
                      className="review reveal"
                      style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
                    >
                      {handle ? (
                        <Link href={`/u/${handle}`} className="review-avatar" tabIndex={-1}>
                          <Avatar url={r.profiles?.avatar_url} name={author} size={40} />
                        </Link>
                      ) : (
                        <Avatar url={r.profiles?.avatar_url} name={author} size={40} />
                      )}
                      <div className="review-body">
                        <p className="review-head">
                          {handle ? (
                            <Link href={`/u/${handle}`} className="review-author">
                              <strong>{author}</strong>
                            </Link>
                          ) : (
                            <strong>{author}</strong>
                          )}
                          {r.score !== null && <span className="review-score">★ {r.score}</span>}
                          <span className={`badge badge-${r.status}`}>
                            {t.status[r.status]}
                          </span>
                          <time className="review-date" dateTime={r.updated_at}>
                            {formatDate(locale, r.updated_at)}
                          </time>
                        </p>
                        {r.review && <p className="review-text">{r.review}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="title-aside reveal" style={{ "--i": 6 } as React.CSSProperties}>
          <EntryForm
            titleId={id}
            loggedIn={Boolean(user)}
            mine={
              mine
                ? {
                    status: mine.status,
                    score: mine.score,
                    review: mine.review,
                    isFavorite: Boolean(mine.is_favorite),
                  }
                : undefined
            }
          />
        </aside>
      </div>

      {details && <Related items={details.related} />}

      {profile?.is_admin && (
        <AdminFix
          titleId={id}
          currentTmdbId={title.tmdb_id}
          defaultQuery={title.original_title ?? title.title}
          query={fix?.trim().slice(0, 100) || undefined}
        />
      )}
    </div>
  );
}
