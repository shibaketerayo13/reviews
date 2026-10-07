import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploader } from "@/components/AvatarUploader";
import { ProfileEntries } from "@/components/ProfileEntries";
import {
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
  is_favorite: boolean;
  favorited_at: string | null;
  updated_at: string;
  titles: Pick<
    Title,
    "id" | "title" | "original_title" | "media_type" | "poster_path" | "release_date"
  > | null;
};

function formatSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

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
      "status, score, review, is_favorite, favorited_at, updated_at, titles(id, title, original_title, media_type, poster_path, release_date)",
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
  const favorites = all
    .filter((e) => e.is_favorite)
    .sort((a, b) => (b.favorited_at ?? "").localeCompare(a.favorited_at ?? ""));
  const since = formatSince(user.created_at);

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
          {since && <p className="profile-since">На сайте с {since}</p>}
          <details className="rename">
            <summary>
              Изменить имя
            </summary>
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
          <Link href="/profile/import" className="profile-import-link">
            Импорт оценок списком →
          </Link>
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

      <section className="favorites">
        <div className="section-head">
          <h2>
            Любимые <span className="fav-heart" aria-hidden="true">♥</span>
          </h2>
          {favorites.length > 0 && <span className="section-count">{favorites.length}</span>}
        </div>
        {favorites.length === 0 ? (
          <p className="muted small-text">
            Отметьте фильм сердечком на его странице или в окне редактирования, и
            он появится здесь.
          </p>
        ) : (
          <ul className="fav-grid">
            {favorites.map((e, i) => {
              const t = e.titles!;
              const poster = posterUrl(t.poster_path, "w342");
              return (
                <li
                  key={t.id}
                  className="reveal"
                  style={{ "--i": Math.min(i, 16) } as React.CSSProperties}
                >
                  <Link href={`/title/${t.id}`} className="fav-tile" title={t.title}>
                    {poster ? (
                      <Image src={poster} alt={t.title} fill sizes="(max-width: 640px) 30vw, 140px" />
                    ) : (
                      <span className="no-poster">{t.title}</span>
                    )}
                    <span className="fav-caption">
                      <span className="fav-title">{t.title}</span>
                      {e.score !== null && <span className="fav-score">{e.score}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProfileEntries
        tabs={
          <nav className="tabs-list" aria-label="Разделы профиля">
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
        }
        empty={
          <div className="empty reveal">
            <p className="empty-title">
              {tab === "all"
                ? "Здесь пока пусто"
                : `В разделе «${STATUS_LABEL[tab as WatchStatus]}» ничего нет`}
            </p>
            <p className="muted">
              Найдите фильм через поиск наверху, откройте его и нажмите «Добавить
              в профиль».
            </p>
          </div>
        }
        entries={shown.map((e) => ({
          titleId: e.titles!.id,
          title: e.titles!.title,
          originalTitle: e.titles!.original_title,
          mediaType: e.titles!.media_type,
          year: yearOf(e.titles!.release_date),
          posterPath: e.titles!.poster_path,
          status: e.status,
          score: e.score,
          review: e.review,
          isFavorite: Boolean(e.is_favorite),
        }))}
      />
    </>
  );
}
