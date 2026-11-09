"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeEntry, updateEntry } from "@/app/profile/actions";
import { FavoriteButton } from "./FavoriteButton";
import { WATCH_STATUSES, type WatchStatus } from "@/lib/types";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";

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
  const { t } = useI18n();
  const [open, setOpen] = useState<ProfileEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
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
              placeholder={t.profile.searchPlaceholder}
              aria-label={t.profile.searchAria}
            />
          )}
          {searchOpen && query && (
            <span className="profile-search-count">{visible.length}</span>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label={searchOpen ? t.profile.closeSearch : t.profile.searchAria}
            aria-expanded={searchOpen}
            title={searchOpen ? t.profile.closeSearch : t.profile.searchAria}
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
          <p className="empty-title">{t.profile.notFoundTitle}</p>
          <p className="muted">{fmt(t.profile.notFoundHint, { q: query.trim() })}</p>
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
                aria-label={fmt(t.entry.openAria, { title: e.title })}
              />
            ) : (
              <button
                type="button"
                className="entry-hit"
                onClick={() => setOpen(e)}
                aria-label={fmt(t.entry.editAria, { title: e.title })}
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
                    <span className="entry-fav" title={t.entry.favOn} aria-label={t.entry.favOn}>
                      {" "}♥
                    </span>
                  )}
                </span>
                {e.score !== null && <span className="entry-score">{e.score}</span>}
              </div>
              <p className="entry-meta">
                <span className={`badge badge-${e.status}`}>{t.status[e.status]}</span>
                <span className="muted">
                  {t.media[e.mediaType]}
                  {e.year && ` · ${e.year}`}
                </span>
              </p>
              {e.review && <p className="entry-review">{e.review}</p>}
            </div>
            <span className="entry-edit" aria-hidden="true">
              {readOnly ? t.entry.open : t.entry.edit}
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
  const { t } = useI18n();
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
        ? fmt(t.entry.toastMoved, { title: entry.title, status: t.status[res.status] })
        : fmt(t.entry.toastSaved, { title: entry.title }),
    );
  }

  async function remove() {
    setBusy(true);
    const res = await removeEntry(entry.titleId);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t.errors.deleteFailed);
    startTransition(() => router.refresh());
    onDone(fmt(t.entry.toastRemoved, { title: entry.title }));
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
              {t.media[entry.mediaType]}
              {entry.year && ` · ${entry.year}`}
            </p>
            <h2 id="entry-dialog-title">{entry.title}</h2>
            <Link href={`/title/${entry.titleId}`} className="modal-link">
              {t.common.openPage}
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
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label={t.common.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          </div>
        </header>

        <div className="modal-body">
          <div className="segmented segmented-full" role="radiogroup" aria-label={t.common.status}>
            {WATCH_STATUSES.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="modal-status"
                  checked={status === s}
                  onChange={() => pickStatus(s)}
                />
                <span>{t.status[s]}</span>
              </label>
            ))}
          </div>

          <fieldset className="mini-scores" disabled={busy}>
            <legend>
              {t.common.score}
              {status === "planned" && <span className="legend-hint">{t.entry.plannedHint}</span>}
            </legend>
            <div className="mini-score-row">
              <label className="mini-score none" title={t.common.noScore}>
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
            <span>{t.common.comment}</span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={t.common.commentPlaceholder}
            />
          </label>

          {error && <p className="field-error">{error}</p>}
        </div>

        <footer className="modal-foot">
          {confirmDelete ? (
            <span className="confirm">
              {t.entry.removeConfirm}{" "}
              <button type="button" className="link-button danger" onClick={remove} disabled={busy}>
                {t.common.yes}
              </button>{" "}
              <button type="button" className="link-button" onClick={() => setConfirmDelete(false)}>
                {t.common.no}
              </button>
            </span>
          ) : (
            <button type="button" className="link-button danger" onClick={() => setConfirmDelete(true)}>
              {t.entry.removeFromProfile}
            </button>
          )}
          <div className="modal-actions">
            <button type="button" className="button button-ghost button-small" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="button button-small"
              onClick={save}
              disabled={busy || !changed}
            >
              {busy ? t.common.saving : t.common.save}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
