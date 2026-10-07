import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import { AvatarUploader } from "@/components/AvatarUploader";
import { ProfileEntries } from "@/components/ProfileEntries";
import { FavoritesRow, ProfileStats, ProfileTabsNav } from "@/components/ProfileSections";
import { ShareProfile } from "@/components/ShareProfile";
import {
  formatSince,
  loadProfileData,
  toProfileEntry,
  type Tab,
} from "@/lib/profile-data";
import { STATUS_LABEL, isWatchStatus, type WatchStatus } from "@/lib/types";
import { updateDisplayName, updateUsername } from "./actions";

export const metadata = { title: "Профиль · reviews" };

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

  const { all, counts, avg, favorites } = await loadProfileData(user.id);
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);
  const since = formatSince(user.created_at);

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
          {profile?.username && <ShareProfile username={profile.username} />}

          <details className="rename">
            <summary>Настройки профиля</summary>
            <form action={updateDisplayName} className="inline-form">
              <input
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                maxLength={40}
                aria-label="Имя на сайте"
                placeholder="Имя на сайте"
              />
              <button type="submit" className="button button-small">
                Сохранить имя
              </button>
            </form>
            <form action={updateUsername} className="inline-form">
              <span className="username-prefix">/u/</span>
              <input
                name="username"
                defaultValue={profile?.username ?? ""}
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]{3,30}"
                title="3–30 символов: латиница, цифры и «_»"
                aria-label="Короткое имя для ссылки"
                placeholder="короткое_имя"
              />
              <button type="submit" className="button button-small">
                Сохранить ссылку
              </button>
            </form>
          </details>
          <Link href="/profile/import" className="profile-import-link">
            Импорт оценок списком →
          </Link>
        </div>

        <ProfileStats counts={counts} avg={avg} />
      </section>

      <FavoritesRow
        favorites={favorites}
        emptyHint="Отметьте фильм сердечком на его странице или в окне редактирования, и он появится здесь."
      />

      <ProfileEntries
        tabs={<ProfileTabsNav basePath="/profile" tab={tab} counts={counts} />}
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
        entries={shown.map(toProfileEntry)}
      />
    </>
  );
}
