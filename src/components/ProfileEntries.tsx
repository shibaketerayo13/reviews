"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeEntry, updateEntry } from "@/app/profile/actions";
import { FavoriteButton } from "./FavoriteButton";
import { MEDIA_LABEL, STATUS_LABEL, WATCH_STATUSES, type WatchStatus } from "@/lib/types";

const POSTER = "/img/t"; // постеры через прокси сайта (lib/images.ts)
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export type ProfileEntry = {
  titleId: number;
  title: string;
  originalTitle: string | null;
  mediaType: "movie" | "tv";
  year: string;
  posterPath: string | null;
  status: WatchStatus;
  score: number | null;
  review: string | null;
  isFavorite: boolean;
};

/** Для поиска: регистр и «ё» не важны, лишние знаки игнорируются. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function ProfileEntries({
  entries,
  tabs,
  empty,
  readOnly = false,
}: {
  entries: ProfileEntry[];
  tabs: React.ReactNode;
  empty: React.ReactNode;
  /** Чужой профиль: клик ведёт на страницу фильма, без окна редактирования. */
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState<ProfileEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);

  const q = norm(query);
  const visible = useMemo(
    () =>
      q
        ? entries.filter((e) =>
            q.split(" ").every((word) =>
              norm(`${e.title} ${e.originalTitle ?? ""} ${e.year}`).includes(word),
            ),
          )
        : entries,
    [entries, q],
  );

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }

  return (
    <>
      <div className={`tabs${searchOpen ? " is-searching" : ""}`}>
        {tabs}
        <div className={`profile-search${searchOpen ? " is-open" : ""}`}>
          {searchOpen && (
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
              placeholder="Найти в профиле"
              aria-label="Поиск по профилю"
            />
          )}
          {searchOpen && query && (
            <span className="profile-search-count">{visible.length}</span>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label={searchOpen ? "Закрыть поиск" : "Поиск по профилю"}
            aria-expanded={searchOpen}
            title={searchOpen ? "Закрыть поиск" : "Поиск по профилю"}
          >
            {searchOpen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        empty
      ) : visible.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Ничего не нашлось</p>
          <p className="muted">
            В этом разделе нет «{query.trim()}». Попробуйте вкладку «Все».
          </p>
        </div>
      ) : (
      <ul className="entries">
        {visible.map((e, i) => (
          <li
            key={e.titleId}
            className="entry reveal"
            style={{ "--i": Math.min(i, 14) } as React.CSSProperties}
          >
            {readOnly ? (
              <Link
                href={`/title/${e.titleId}`}
                className="entry-hit"
                aria-label={`Открыть: ${e.title}`}
              />
            ) : (
              <button
                type="button"
                className="entry-hit"
                onClick={() => setOpen(e)}
                aria-label={`Изменить: ${e.title}`}
              />
            )}
            <div className="entry-poster">
              {e.posterPath ? (
                <Image src={`${POSTER}/w185${e.posterPath}`} alt="" fill sizes="80px" />
              ) : (
                <div className="no-poster" />
              )}
            </div>
            <div className="entry-body">
              <div className="entry-top">
                <span className="entry-title">
                  {e.title}
                  {e.isFavorite && (
                    <span className="entry-fav" title="В любимых" aria-label="В любимых">
                      {" "}♥
                    </span>
                  )}
                </span>
                {e.score !== null && <span className="entry-score">{e.score}</span>}
              </div>
              <p className="entry-meta">
                <span className={`badge badge-${e.status}`}>{STATUS_LABEL[e.status]}</span>
                <span className="muted">
                  {MEDIA_LABEL[e.mediaType]}
                  {e.year && ` · ${e.year}`}
                </span>
              </p>
              {e.review && <p className="entry-review">{e.review}</p>}
            </div>
            <span className="entry-edit" aria-hidden="true">
              {readOnly ? "Открыть →" : "Изменить"}
            </span>
          </li>
        ))}
      </ul>
      )}

      {open && !readOnly && (
        <EntryDialog
          key={open.titleId}
          entry={open}
          onClose={() => setOpen(null)}
          onDone={(text) => {
            setOpen(null);
            setToast(text);
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function EntryDialog({
  entry,
  onClose,
  onDone,
}: {
  entry: ProfileEntry;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<WatchStatus>(entry.status);
  const [score, setScore] = useState<number | null>(entry.score);
  const [review, setReview] = useState(entry.review ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Закрытие по Esc
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener("cancel", onCancel);
    return () => d?.removeEventListener("cancel", onCancel);
  }, [onClose]);

  function pickScore(s: number | null) {
    setScore(s);
    // Оценка у фильма «на потом» означает, что его уже посмотрели
    if (s !== null && status === "planned") setStatus("watched");
  }

  function pickStatus(s: WatchStatus) {
    setStatus(s);
    if (s === "planned") setScore(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateEntry({ titleId: entry.titleId, status, score, review });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    startTransition(() => router.refresh());
    onDone(
      res.status !== entry.status
        ? `«${entry.title}» → ${STATUS_LABEL[res.status]}`
        : `«${entry.title}» сохранён`,
    );
  }

  async function remove() {
    setBusy(true);
    const res = await removeEntry(entry.titleId);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Не удалось удалить");
    startTransition(() => router.refresh());
    onDone(`«${entry.title}» убран из профиля`);
  }

  const backdrop = entry.posterPath ? `${POSTER}/w342${entry.posterPath}` : null;
  const changed =
    status !== entry.status || score !== entry.score || review.trim() !== (entry.review ?? "");

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="entry-dialog-title"
      onClick={(e) => {
        // Клик по затемнению вокруг окна закрывает его
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-panel">
        {backdrop && (
          <div className="modal-glow" aria-hidden="true">
            <Image src={backdrop} alt="" fill sizes="480px" />
          </div>
        )}

        <header className="modal-head">
          <div className="modal-poster">
            {entry.posterPath ? (
              <Image src={`${POSTER}/w185${entry.posterPath}`} alt="" fill sizes="72px" />
            ) : (
              <div className="no-poster" />
            )}
          </div>
          <div>
            <p className="eyebrow">
              {MEDIA_LABEL[entry.mediaType]}
              {entry.year && ` · ${entry.year}`}
            </p>
            <h2 id="entry-dialog-title">{entry.title}</h2>
            <Link href={`/title/${entry.titleId}`} className="modal-link">
              Открыть страницу →
            </Link>
          </div>
          <div className="modal-tools">
            {/* Любимый фильм из «на потом» сервер переносит в «Просмотрено»: показываем это сразу */}
            <FavoriteButton
              titleId={entry.titleId}
              initial={entry.isFavorite}
              onChange={(on) => {
                if (on && status === "planned") setStatus("watched");
              }}
            />
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          </div>
        </header>

        <div className="modal-body">
          <div className="segmented segmented-full" role="radiogroup" aria-label="Статус">
            {WATCH_STATUSES.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="modal-status"
                  checked={status === s}
                  onChange={() => pickStatus(s)}
                />
                <span>{STATUS_LABEL[s]}</span>
              </label>
            ))}
          </div>

          <fieldset className="mini-scores" disabled={busy}>
            <legend>
              Оценка
              {status === "planned" && (
                <span className="legend-hint"> · поставьте, и фильм перейдёт в «Просмотрено»</span>
              )}
            </legend>
            <div className="mini-score-row">
              <label className="mini-score none" title="Без оценки">
                <input
                  type="radio"
                  name="modal-score"
                  checked={score === null}
                  onChange={() => pickScore(null)}
                />
                <span>—</span>
              </label>
              {SCORES.map((s) => (
                <label key={s} className="mini-score">
                  <input
                    type="radio"
                    name="modal-score"
                    checked={score === s}
                    onChange={() => pickScore(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Комментарий</span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Пара слов на память…"
            />
          </label>

          {error && <p className="field-error">{error}</p>}
        </div>

        <footer className="modal-foot">
          {confirmDelete ? (
            <span className="confirm">
              Убрать из профиля?{" "}
              <button type="button" className="link-button danger" onClick={remove} disabled={busy}>
                Да
              </button>{" "}
              <button type="button" className="link-button" onClick={() => setConfirmDelete(false)}>
                Нет
              </button>
            </span>
          ) : (
            <button type="button" className="link-button danger" onClick={() => setConfirmDelete(true)}>
              Убрать из профиля
            </button>
          )}
          <div className="modal-actions">
            <button type="button" className="button button-ghost button-small" onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className="button button-small"
              onClick={save}
              disabled={busy || !changed}
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
