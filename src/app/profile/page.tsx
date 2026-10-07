import Link from "next/link";
import Image from "next/image";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { posterUrl } from "@/lib/tmdb";
import {
  MEDIA_LABEL,
  STATUS_LABEL,
  WATCH_STATUSES,
  isWatchStatus,
  yearOf,
  type Title,
  type WatchStatus,
} from "@/lib/types";
import { updateDisplayName } from "./actions";

export const metadata = { title: "Профиль · reviews" };

type Entry = {
  status: WatchStatus;
  score: number | null;
  review: string | null;
  updated_at: string;
  titles: Pick<Title, "id" | "title" | "media_type" | "poster_path" | "release_date"> | null;
};

type Tab = "all" | WatchStatus;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; message?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  const { tab: rawTab, error, message } = await searchParams;
  const tab: Tab = isWatchStatus(rawTab) ? rawTab : "all";

  const supabase = await createClient();
  const { data } = await supabase
    .from("ratings")
    .select(
      "status, score, review, updated_at, titles(id, title, media_type, poster_path, release_date)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const all = ((data ?? []) as unknown as Entry[]).filter((e) => e.titles);
  const counts: Record<Tab, number> = {
    all: all.length,
    watched: all.filter((e) => e.status === "watched").length,
    planned: all.filter((e) => e.status === "planned").length,
    dropped: all.filter((e) => e.status === "dropped").length,
  };
  const scored = all.filter((e) => e.score !== null);
  const avg =
    scored.length > 0
      ? (scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length).toFixed(1)
      : null;
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Все" },
    ...WATCH_STATUSES.map((s) => ({ key: s as Tab, label: STATUS_LABEL[s] })),
  ];

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="panel profile-head">
        <div>
          <h1>{profile?.display_name ?? user.email}</h1>
          <p className="muted">
            {user.email}
            {profile?.is_admin && (
              <>
                {" · "}
                <Link href="/admin">админ</Link>
              </>
            )}
          </p>
          <p>
            Просмотрено: <strong>{counts.watched}</strong>
            {" · "}оценок: <strong>{scored.length}</strong>
            {avg && (
              <>
                {" · "}средняя: <strong>{avg}</strong>
              </>
            )}
          </p>
        </div>
        <form action={updateDisplayName} className="inline-form">
          <input
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            maxLength={40}
            aria-label="Имя на сайте"
          />
          <button type="submit">Сохранить имя</button>
        </form>
      </section>

      <nav className="tabs" aria-label="Разделы профиля">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/profile" : `/profile?tab=${t.key}`}
            className={`tab${tab === t.key ? " active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label} <span className="tab-count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="muted">
          {tab === "all"
            ? "В профиле пока пусто. "
            : `В разделе «${STATUS_LABEL[tab as WatchStatus]}» пока ничего нет. `}
          Найдите фильм через <Link href="/search">поиск</Link>, откройте его и
          нажмите «Добавить в профиль».
        </p>
      ) : (
        <ul className="rating-list">
          {shown.map((e) => {
            const t = e.titles!;
            const poster = posterUrl(t.poster_path, "w154");
            return (
              <li key={t.id} className="rating-item">
                <Link href={`/title/${t.id}`} className="rating-poster">
                  {poster ? (
                    <Image src={poster} alt={t.title} width={70} height={105} />
                  ) : (
                    <div className="no-poster small">—</div>
                  )}
                </Link>
                <div className="rating-body">
                  <Link href={`/title/${t.id}`}>
                    <strong>{t.title}</strong>
                  </Link>{" "}
                  <span className="muted small-text">
                    {MEDIA_LABEL[t.media_type]} {yearOf(t.release_date)}
                  </span>
                  <p className="entry-meta">
                    <span className={`badge badge-${e.status}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                    {e.score !== null && <span className="score">★ {e.score}/10</span>}
                  </p>
                  {e.review && <p className="review-text">{e.review}</p>}
                  <Link href={`/title/${t.id}`} className="small-text">
                    Изменить
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
