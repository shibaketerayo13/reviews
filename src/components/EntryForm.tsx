import Link from "next/link";
import { WATCH_STATUSES, type WatchStatus } from "@/lib/types";
import { deleteRating, saveRating } from "@/app/title/[id]/actions";
import { FavoriteButton } from "./FavoriteButton";
import { getI18n } from "@/lib/i18n/server";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Mine = {
  status: WatchStatus;
  score: number | null;
  review: string | null;
  isFavorite: boolean;
};

/** Компактная форма «в профиль»: статус, оценка, комментарий. */
export async function EntryForm({
  titleId,
  mine,
  loggedIn,
}: {
  titleId: number;
  mine?: Mine;
  loggedIn: boolean;
}) {
  const { t } = await getI18n();
  return (
    <section className="entry-card">
      <header className="entry-card-head">
        <h2>{t.entry.diary}</h2>
        <div className="entry-card-tools">
          {mine && <span className={`badge badge-${mine.status}`}>{t.status[mine.status]}</span>}
          {loggedIn && <FavoriteButton titleId={titleId} initial={Boolean(mine?.isFavorite)} />}
        </div>
      </header>

      {!loggedIn ? (
        <p className="muted small-text">
          <Link href="/login">{t.entry.loginLink}</Link>
          {t.entry.loginRest}
        </p>
      ) : (
        <>
          <form action={saveRating} className="entry-compact">
            <input type="hidden" name="title_id" value={titleId} />

            <div className="segmented segmented-full" role="radiogroup" aria-label={t.common.status}>
              {WATCH_STATUSES.map((s) => (
                <label key={s} title={t.status[s]}>
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    defaultChecked={(mine?.status ?? "watched") === s}
                    required
                  />
                  <span>{t.statusShort[s]}</span>
                </label>
              ))}
            </div>

            <fieldset className="mini-scores">
              <legend>{t.common.score}</legend>
              <div className="mini-score-row">
                <label className="mini-score none" title={t.common.noScore}>
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
              <summary>{t.common.comment}</summary>
              <textarea
                name="review"
                rows={3}
                maxLength={5000}
                defaultValue={mine?.review ?? ""}
                placeholder={t.common.commentPlaceholder}
              />
            </details>

            <button type="submit" className="button button-block">
              {mine ? t.common.save : t.entry.addToProfile}
            </button>
          </form>

          {mine && (
            <form action={deleteRating} className="entry-remove">
              <input type="hidden" name="title_id" value={titleId} />
              <button type="submit" className="link-button danger">
                {t.entry.removeFromProfile}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
