"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Suggestion, SuggestResponse } from "@/app/api/suggest/route";
import type { UserHit } from "@/lib/users";
import { Avatar } from "./Avatar";

const POSTER = "https://image.tmdb.org/t/p/w92";
const TYPE_LABEL = { movie: "Фильм", tv: "Сериал" } as const;

type Option =
  | { kind: "title"; href: string; item: Suggestion }
  | { kind: "user"; href: string; user: UserHit }
  | { kind: "all"; href: string };

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Запрос подсказок с задержкой 180 мс; старый запрос отменяется
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setUsers([]);
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
        const json = (await res.json()) as SuggestResponse;
        setItems(json.items ?? []);
        setUsers(json.users ?? []);
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

  // Закрываем по касанию или клику вне поиска (pointerdown работает и на телефоне)
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const term = q.trim();
  // Единый список для клавиатуры: фильмы, люди, «все результаты»
  const options: Option[] = [
    ...items.map((item) => ({ kind: "title" as const, href: `/title/${item.id}`, item })),
    ...users.map((user) => ({ kind: "user" as const, href: `/u/${user.username}`, user })),
    { kind: "all", href: `/search?q=${encodeURIComponent(term)}` },
  ];

  function go(path: string) {
    setOpen(false);
    setQ("");
    // На телефоне прячем клавиатуру после перехода
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    router.push(path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = options.length;
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
    } else if (e.key === "Enter" && open && active >= 0 && active < total) {
      e.preventDefault();
      go(options[active].href);
    }
  }

  const showPanel = open && term.length >= 2;
  const nothing = items.length === 0 && users.length === 0 && !loading;

  function optionProps(index: number, href: string) {
    return {
      id: `${listId}-${index}`,
      href,
      role: "option" as const,
      "aria-selected": active === index,
      onMouseEnter: () => setActive(index),
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        go(href);
      },
    };
  }

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
        onFocus={() => (items.length || users.length) && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Фильм, сериал или @человек"
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
          {nothing && <p className="suggest-empty">Ничего не нашлось</p>}

          {options.map((opt, i) => {
            if (opt.kind === "title") {
              const it = opt.item;
              return (
                <a
                  key={`t${it.id}`}
                  {...optionProps(i, opt.href)}
                  className={`suggest-item${active === i ? " is-active" : ""}`}
                  style={{ "--i": i } as React.CSSProperties}
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
                      {it.original_title &&
                        it.original_title !== it.title &&
                        ` · ${it.original_title}`}
                    </span>
                  </span>
                  {it.tmdb_rating ? (
                    <span className="suggest-rating">{it.tmdb_rating.toFixed(1)}</span>
                  ) : null}
                </a>
              );
            }
            if (opt.kind === "user") {
              const u = opt.user;
              const name = u.display_name ?? u.username;
              const firstUser = i === items.length;
              return (
                <div key={`u${u.username}`} className="suggest-group">
                  {firstUser && <p className="suggest-label">Люди</p>}
                  <a
                    {...optionProps(i, opt.href)}
                    className={`suggest-item suggest-user${active === i ? " is-active" : ""}`}
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <Avatar url={u.avatar_url} name={name} size={36} />
                    <span className="suggest-text">
                      <span className="suggest-title">{name}</span>
                      <span className="suggest-meta">@{u.username}</span>
                    </span>
                  </a>
                </div>
              );
            }
            return (
              <a
                key="all"
                {...optionProps(i, opt.href)}
                className={`suggest-all${active === i ? " is-active" : ""}`}
              >
                Все результаты по «{term}» →
              </a>
            );
          })}
        </div>
      )}
    </form>
  );
}
