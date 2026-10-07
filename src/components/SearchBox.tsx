"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Suggestion } from "@/app/api/suggest/route";

const POSTER = "https://image.tmdb.org/t/p/w92";
const TYPE_LABEL = { movie: "Фильм", tv: "Сериал" } as const;

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Запрос подсказок с задержкой 180 мс; старый запрос отменяется
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as { items: Suggestion[] };
        setItems(json.items ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* отменённый запрос или нет сети: молча */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  // Закрываем по клику вне поиска
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(path: string) {
    setOpen(false);
    setQ("");
    router.push(path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = items.length + 1; // + строка «Все результаты»
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && open && active >= 0 && active < items.length) {
      e.preventDefault();
      go(`/title/${items[active].id}`);
    }
  }

  const term = q.trim();
  const showPanel = open && term.length >= 2;
  const allIndex = items.length;

  return (
    <form
      ref={box}
      action="/search"
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (term) go(`/search?q=${encodeURIComponent(term)}`);
      }}
    >
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input
        name="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Найти фильм или сериал"
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Поиск"
      />
      {loading && <span className="search-spinner" aria-hidden="true" />}

      {showPanel && (
        <div className="suggest" id={listId} role="listbox">
          {items.length === 0 && !loading && (
            <p className="suggest-empty">В каталоге ничего не нашлось</p>
          )}
          {items.map((it, i) => (
            <a
              key={it.id}
              id={`${listId}-${i}`}
              href={`/title/${it.id}`}
              role="option"
              aria-selected={active === i}
              className={`suggest-item${active === i ? " is-active" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => {
                e.preventDefault();
                go(`/title/${it.id}`);
              }}
            >
              {it.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${POSTER}${it.poster_path}`} alt="" width={36} height={54} />
              ) : (
                <span className="suggest-noposter" />
              )}
              <span className="suggest-text">
                <span className="suggest-title">{it.title}</span>
                <span className="suggest-meta">
                  {TYPE_LABEL[it.media_type]}
                  {it.year && ` · ${it.year}`}
                  {it.original_title && it.original_title !== it.title && ` · ${it.original_title}`}
                </span>
              </span>
              {it.tmdb_rating ? (
                <span className="suggest-rating">{it.tmdb_rating.toFixed(1)}</span>
              ) : null}
            </a>
          ))}
          <a
            id={`${listId}-${allIndex}`}
            href={`/search?q=${encodeURIComponent(term)}`}
            role="option"
            aria-selected={active === allIndex}
            className={`suggest-all${active === allIndex ? " is-active" : ""}`}
            onMouseEnter={() => setActive(allIndex)}
            onClick={(e) => {
              e.preventDefault();
              go(`/search?q=${encodeURIComponent(term)}`);
            }}
          >
            Все результаты по «{term}» →
          </a>
        </div>
      )}
    </form>
  );
}
