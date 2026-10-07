import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getTitleStats } from "@/lib/catalog";
import { posterUrl } from "@/lib/tmdb";
import { Avatar } from "@/components/Avatar";
import {
  MEDIA_LABEL,
  STATUS_LABEL,
  WATCH_STATUSES,
  yearOf,
  type Title,
  type WatchStatus,
} from "@/lib/types";
import { deleteRating, saveRating } from "./actions";

type ReviewRow = {
  user_id: string;
  status: WatchStatus;
  score: number | null;
  review: string | null;
  updated_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id: rawId } = await params;
  const { error, message } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const { data: title } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Title>();
  if (!title) notFound();

  const user = await getUser();
  const [stats, { data: reviewsData }] = await Promise.all([
    getTitleStats([id]),
    supabase
      .from("ratings")
      .select(
        "user_id, status, score, review, updated_at, profiles(display_name, avatar_url)",
      )
      .eq("title_id", id)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  const entries = (reviewsData ?? []) as unknown as ReviewRow[];
  const mine = user ? entries.find((r) => r.user_id === user.id) : undefined;
  // В блок отзывов попадают только записи с оценкой или комментарием
  const reviews = entries.filter((r) => r.score !== null || r.review);
  const stat = stats.get(id);
  const poster = posterUrl(title.poster_path, "w500");
  const backdrop = posterUrl(title.backdrop_path, "w1280");

  return (
    <div className="title-page">
      {backdrop && (
        <div className="title-backdrop" aria-hidden="true">
          <Image src={backdrop} alt="" fill priority sizes="100vw" />
        </div>
      )}

      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="title-hero">
        <div className="title-poster reveal">
          {poster ? (
            <Image
              src={poster}
              alt={title.title}
              fill
              sizes="(max-width: 640px) 60vw, 280px"
              priority
            />
          ) : (
            <div className="no-poster">{title.title}</div>
          )}
        </div>

        <div className="title-info">
          <p className="eyebrow reveal" style={{ "--i": 1 } as React.CSSProperties}>
            {MEDIA_LABEL[title.media_type]}
            {title.release_date && ` · ${yearOf(title.release_date)}`}
          </p>
          <h1 className="title-name reveal" style={{ "--i": 2 } as React.CSSProperties}>
            {title.title}
          </h1>
          {title.original_title && title.original_title !== title.title && (
            <p className="title-original reveal" style={{ "--i": 3 } as React.CSSProperties}>
              {title.original_title}
            </p>
          )}

          <dl className="scores reveal" style={{ "--i": 4 } as React.CSSProperties}>
            <div>
              <dt>Оценка сайта</dt>
              <dd>
                {stat ? (
                  <>
                    <span className="score-big">{stat.avg.toFixed(1)}</span>
                    <span className="score-sub">{stat.count} оц.</span>
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
                <dt>Ваша</dt>
                <dd>
                  <span className="score-big accent">{mine.score}</span>
                </dd>
              </div>
            )}
          </dl>

          {title.overview && (
            <p className="title-overview reveal" style={{ "--i": 5 } as React.CSSProperties}>
              {title.overview}
            </p>
          )}
        </div>
      </section>

      <section className="panel entry-panel reveal" style={{ "--i": 6 } as React.CSSProperties}>
        <div className="entry-head">
          <h2>{mine ? "В вашем профиле" : "Добавить в профиль"}</h2>
          {mine && (
            <span className={`badge badge-${mine.status}`}>{STATUS_LABEL[mine.status]}</span>
          )}
        </div>
        {user ? (
          <>
            <form action={saveRating} className="entry-form">
              <input type="hidden" name="title_id" value={id} />

              <fieldset className="choice-group">
                <legend>Статус</legend>
                <div className="segmented">
                  {WATCH_STATUSES.map((s) => (
                    <label key={s}>
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        defaultChecked={(mine?.status ?? "watched") === s}
                        required
                      />
                      <span>{STATUS_LABEL[s]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="choice-group">
                <legend>Личная оценка</legend>
                <div className="score-picker">
                  <label className="score-pill none">
                    <input
                      type="radio"
                      name="score"
                      value=""
                      defaultChecked={mine?.score == null}
                    />
                    <span>—</span>
                  </label>
                  {SCORES.map((s) => (
                    <label key={s} className="score-pill">
                      <input
                        type="radio"
                        name="score"
                        value={s}
                        defaultChecked={mine?.score === s}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                <span>Комментарий</span>
                <textarea
                  name="review"
                  rows={4}
                  maxLength={5000}
                  defaultValue={mine?.review ?? ""}
                  placeholder="Впечатления, заметки для себя…"
                />
              </label>

              <div className="entry-actions">
                <button type="submit" className="button">
                  {mine ? "Сохранить" : "Добавить в профиль"}
                </button>
              </div>
            </form>
            {mine && (
              <form action={deleteRating} className="entry-remove">
                <input type="hidden" name="title_id" value={id} />
                <button type="submit" className="link-button danger">
                  Убрать из профиля
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="muted">
            <Link href="/login">Войдите</Link>, чтобы добавить фильм в профиль,
            поставить оценку и оставить комментарий.
          </p>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Отзывы</h2>
          <span className="section-count">{reviews.length}</span>
        </div>
        {reviews.length === 0 ? (
          <p className="muted">Пока никто не оценил. Будьте первым.</p>
        ) : (
          <ul className="review-list">
            {reviews.map((r, i) => {
              const name = r.profiles?.display_name ?? "Пользователь";
              return (
                <li
                  key={r.user_id}
                  className="review reveal"
                  style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
                >
                  <Avatar url={r.profiles?.avatar_url} name={name} size={40} />
                  <div className="review-body">
                    <p className="review-head">
                      <strong>{name}</strong>
                      {r.score !== null && <span className="review-score">★ {r.score}</span>}
                      <span className={`badge badge-${r.status}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <time className="review-date" dateTime={r.updated_at}>
                        {new Date(r.updated_at).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
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
  );
}
