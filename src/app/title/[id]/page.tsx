import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getTitleStats } from "@/lib/catalog";
import { posterUrl } from "@/lib/tmdb";
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
  profiles: { display_name: string | null } | null;
};

const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

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
      .select("user_id, status, score, review, updated_at, profiles(display_name)")
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

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="title-hero">
        {poster ? (
          <Image
            src={poster}
            alt={title.title}
            width={300}
            height={450}
            className="title-poster"
            priority
          />
        ) : (
          <div className="no-poster title-poster">нет постера</div>
        )}
        <div>
          <h1>{title.title}</h1>
          <p className="muted">
            {MEDIA_LABEL[title.media_type]} {yearOf(title.release_date)}
            {title.original_title && title.original_title !== title.title && (
              <> · {title.original_title}</>
            )}
          </p>
          <p className="big-score">
            {stat ? (
              <>
                ★ {stat.avg.toFixed(1)}
                <span className="muted small-text">
                  {" "}
                  оценок на сайте: {stat.count}
                </span>
              </>
            ) : (
              <span className="muted small-text">На сайте ещё нет оценок</span>
            )}
          </p>
          {title.tmdb_rating != null && (
            <p className="muted small-text">TMDB: {title.tmdb_rating}</p>
          )}
          {title.overview && <p>{title.overview}</p>}
        </div>
      </section>

      <section className="panel">
        <h2>
          {mine ? `В вашем профиле: ${STATUS_LABEL[mine.status].toLowerCase()}` : "Добавить в профиль"}
        </h2>
        {user ? (
          <>
            <form action={saveRating} className="form">
              <input type="hidden" name="title_id" value={id} />
              <fieldset className="status-picker">
                <legend>Статус</legend>
                {WATCH_STATUSES.map((s) => (
                  <label key={s} className="status-option">
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
              </fieldset>
              <label>
                Личная оценка (необязательно)
                <select name="score" defaultValue={mine?.score ?? ""}>
                  <option value="">без оценки</option>
                  {SCORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Комментарий (необязательно)
                <textarea
                  name="review"
                  rows={4}
                  maxLength={5000}
                  defaultValue={mine?.review ?? ""}
                  placeholder="Впечатления, заметки для себя…"
                />
              </label>
              <button type="submit">{mine ? "Сохранить изменения" : "Добавить в профиль"}</button>
            </form>
            {mine && (
              <form action={deleteRating}>
                <input type="hidden" name="title_id" value={id} />
                <button type="submit" className="link-button danger">
                  Убрать из профиля
                </button>
              </form>
            )}
          </>
        ) : (
          <p>
            <Link href="/login">Войдите</Link>, чтобы добавить фильм в профиль,
            поставить оценку и оставить комментарий.
          </p>
        )}
      </section>

      <section>
        <h2>Отзывы</h2>
        {reviews.length === 0 ? (
          <p className="muted">Пока никто не оценил.</p>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.user_id} className="panel">
                <p>
                  <strong>{r.profiles?.display_name ?? "Пользователь"}</strong>{" "}
                  {r.score !== null && <span className="score">★ {r.score}/10</span>}{" "}
                  <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>{" "}
                  <span className="muted small-text">
                    {new Date(r.updated_at).toLocaleDateString("ru-RU")}
                  </span>
                </p>
                {r.review && <p className="review-text">{r.review}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
