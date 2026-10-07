import Link from "next/link";
import Image from "next/image";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { posterUrl } from "@/lib/tmdb";
import { AvatarUploader } from "@/components/AvatarUploader";
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
  const name = profile?.display_name ?? user.email ?? "";

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
      : "—";
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Все" },
    ...WATCH_STATUSES.map((s) => ({ key: s as Tab, label: STATUS_LABEL[s] })),
  ];

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="profile-hero reveal">
        <AvatarUploader userId={user.id} name={name} url={profile?.avatar_url ?? null} />

        <div className="profile-main">
          <p className="eyebrow">
            Профиль
            {profile?.is_admin && (
              <>
                {" · "}
                <Link href="/admin">администратор</Link>
              </>
            )}
          </p>
          <h1 className="profile-name">{name}</h1>
          <details className="rename">
            <summary>Изменить имя</summary>
            <form action={updateDisplayName} className="inline-form">
              <input
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                maxLength={40}
                aria-label="Имя на сайте"
              />
              <button type="submit" className="button button-small">
                Сохранить
              </button>
            </form>
          </details>
        </div>

        <dl className="profile-stats">
          <div>
            <dt>Просмотрено</dt>
            <dd>{counts.watched}</dd>
          </div>
          <div>
            <dt>В планах</dt>
            <dd>{counts.planned}</dd>
          </div>
          <div>
            <dt>Брошено</dt>
            <dd>{counts.dropped}</dd>
          </div>
          <div>
            <dt>Средняя оценка</dt>
            <dd className="accent">{avg}</dd>
          </div>
        </dl>
      </section>

      <nav className="tabs" aria-label="Разделы профиля">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/profile" : `/profile?tab=${t.key}`}
            className={`tab${tab === t.key ? " active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
            scroll={false}
          >
            {t.label}
            <span className="tab-count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="empty reveal">
          <p className="empty-title">
            {tab === "all" ? "Здесь пока пусто" : `В разделе «${STATUS_LABEL[tab as WatchStatus]}» ничего нет`}
          </p>
          <p className="muted">
            Найдите фильм через поиск наверху, откройте его и нажмите «Добавить
            в профиль».
          </p>
        </div>
      ) : (
        <ul className="entries" key={tab}>
          {shown.map((e, i) => {
            const t = e.titles!;
            const poster = posterUrl(t.poster_path, "w185");
            return (
              <li
                key={t.id}
                className="entry reveal"
                style={{ "--i": Math.min(i, 14) } as React.CSSProperties}
              >
                <Link href={`/title/${t.id}`} className="entry-poster" tabIndex={-1}>
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="80px" />
                  ) : (
                    <div className="no-poster" />
                  )}
                </Link>
                <div className="entry-body">
                  <div className="entry-top">
                    <Link href={`/title/${t.id}`} className="entry-title">
                      {t.title}
                    </Link>
                    {e.score !== null && <span className="entry-score">{e.score}</span>}
                  </div>
                  <p className="entry-meta">
                    <span className={`badge badge-${e.status}`}>{STATUS_LABEL[e.status]}</span>
                    <span className="muted">
                      {MEDIA_LABEL[t.media_type]}
                      {t.release_date && ` · ${yearOf(t.release_date)}`}
                    </span>
                  </p>
                  {e.review && <p className="entry-review">{e.review}</p>}
                </div>
                <Link href={`/title/${t.id}`} className="entry-edit" aria-label={`Изменить: ${t.title}`}>
                  Изменить
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
