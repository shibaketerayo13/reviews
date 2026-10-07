import Link from "next/link";
import { STATUS_LABEL, WATCH_STATUSES, type WatchStatus } from "@/lib/types";
import { deleteRating, saveRating } from "@/app/title/[id]/actions";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SHORT_STATUS: Record<WatchStatus, string> = {
  watched: "Смотрел",
  planned: "Позже",
  dropped: "Бросил",
};

type Mine = { status: WatchStatus; score: number | null; review: string | null };

/** Компактная форма «в профиль»: статус, оценка, комментарий. */
export function EntryForm({
  titleId,
  mine,
  loggedIn,
}: {
  titleId: number;
  mine?: Mine;
  loggedIn: boolean;
}) {
  return (
    <section className="entry-card">
      <header className="entry-card-head">
        <h2>Мой дневник</h2>
        {mine && <span className={`badge badge-${mine.status}`}>{STATUS_LABEL[mine.status]}</span>}
      </header>

      {!loggedIn ? (
        <p className="muted small-text">
          <Link href="/login">Войдите</Link>, чтобы отметить фильм, поставить
          оценку и оставить комментарий.
        </p>
      ) : (
        <>
          <form action={saveRating} className="entry-compact">
            <input type="hidden" name="title_id" value={titleId} />

            <div className="segmented segmented-full" role="radiogroup" aria-label="Статус">
              {WATCH_STATUSES.map((s) => (
                <label key={s} title={STATUS_LABEL[s]}>
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    defaultChecked={(mine?.status ?? "watched") === s}
                    required
                  />
                  <span>{SHORT_STATUS[s]}</span>
                </label>
              ))}
            </div>

            <fieldset className="mini-scores">
              <legend>Оценка</legend>
              <div className="mini-score-row">
                <label className="mini-score none" title="Без оценки">
                  <input type="radio" name="score" value="" defaultChecked={mine?.score == null} />
                  <span>—</span>
                </label>
                {SCORES.map((s) => (
                  <label key={s} className="mini-score">
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

            <details className="entry-note" open={Boolean(mine?.review)}>
              <summary>Комментарий</summary>
              <textarea
                name="review"
                rows={3}
                maxLength={5000}
                defaultValue={mine?.review ?? ""}
                placeholder="Пара слов на память…"
              />
            </details>

            <button type="submit" className="button button-block">
              {mine ? "Сохранить" : "Добавить в профиль"}
            </button>
          </form>

          {mine && (
            <form action={deleteRating} className="entry-remove">
              <input type="hidden" name="title_id" value={titleId} />
              <button type="submit" className="link-button danger">
                Убрать из профиля
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
