import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import { AvatarUploader } from "@/components/AvatarUploader";
import { ProfileEntries } from "@/components/ProfileEntries";
import { FavoritesRow, ProfileStats, ProfileTabsNav } from "@/components/ProfileSections";
import { ShareProfile } from "@/components/ShareProfile";
import { TelegramLink } from "@/components/TelegramLink";
import {
  formatSince,
  loadProfileData,
  toProfileEntry,
  type Tab,
} from "@/lib/profile-data";
import { isWatchStatus, type WatchStatus } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { updateDisplayName, updateUsername } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.meta.profile} · reviews` };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; message?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  const { locale, t } = await getI18n();
  const { tab: rawTab, error, message } = await searchParams;
  const tab: Tab = isWatchStatus(rawTab) ? rawTab : "all";
  const name = profile?.display_name ?? user.email ?? "";

  const { all, counts, avg, favorites } = await loadProfileData(user.id);
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);
  const since = formatSince(locale, user.created_at);

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="profile-hero reveal">
        <AvatarUploader userId={user.id} name={name} url={profile?.avatar_url ?? null} />

        <div className="profile-main">
          <p className="eyebrow">
            {t.profile.eyebrow}
            {profile?.is_admin && (
              <>
                {" · "}
                <Link href="/admin">{t.profile.admin}</Link>
              </>
            )}
          </p>
          <h1 className="profile-name">{name}</h1>
          {since && <p className="profile-since">{fmt(t.profile.since, { date: since })}</p>}
          {profile?.username && <ShareProfile username={profile.username} />}

          <details className="rename">
            <summary>{t.profile.settings}</summary>
            <form action={updateDisplayName} className="inline-form">
              <input
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                maxLength={40}
                aria-label={t.profile.displayName}
                placeholder={t.profile.displayName}
              />
              <button type="submit" className="button button-small">
                {t.profile.saveName}
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
                title={t.profile.usernameHint}
                aria-label={t.profile.usernameAria}
                placeholder={t.profile.usernamePlaceholder}
              />
              <button type="submit" className="button button-small">
                {t.profile.saveLink}
              </button>
            </form>
          </details>
          <Link href="/profile/import" className="profile-import-link">
            {t.profile.importLink}
          </Link>
          <TelegramLink userId={user.id} />
        </div>

        <ProfileStats counts={counts} avg={avg} />
      </section>

      <FavoritesRow
        favorites={favorites}
        emptyHint={t.profile.favEmpty}
      />

      <ProfileEntries
        tabs={<ProfileTabsNav basePath="/profile" tab={tab} counts={counts} />}
        empty={
          <div className="empty reveal">
            <p className="empty-title">
              {tab === "all"
                ? t.profile.emptyAll
                : fmt(t.profile.emptyTab, { tab: t.status[tab as WatchStatus] })}
            </p>
            <p className="muted">{t.profile.emptyHint}</p>
          </div>
        }
        entries={shown.map((e) => toProfileEntry(e, locale))}
      />
    </>
  );
}
