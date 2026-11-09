// Публичный профиль: открывается по ссылке без регистрации.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ProfileEntries } from "@/components/ProfileEntries";
import { FavoritesRow, ProfileStats, ProfileTabsNav } from "@/components/ProfileSections";
import {
  formatSince,
  loadProfileData,
  toProfileEntry,
  type Tab,
} from "@/lib/profile-data";
import { isWatchStatus, type WatchStatus } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

async function findProfile(username: string): Promise<PublicProfile | null> {
  const clean = username.toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(clean)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("username", clean)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [p, { t }] = await Promise.all([findProfile(username), getI18n()]);
  if (!p) return { title: `${t.meta.profileNotFound} · reviews` };
  const name = p.display_name ?? p.username;
  return {
    title: `${name} · reviews`,
    description: fmt(t.meta.publicDescription, { name }),
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab: rawTab } = await searchParams;
  const profile = await findProfile(username);
  if (!profile) notFound();

  const tab: Tab = isWatchStatus(rawTab) ? rawTab : "all";
  const [viewer, data, { locale, t }] = await Promise.all([
    getUser(),
    loadProfileData(profile.id),
    getI18n(),
  ]);
  const { all, counts, avg, favorites } = data;
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);
  const name = profile.display_name ?? profile.username;
  const since = formatSince(locale, profile.created_at);
  const isMe = viewer?.id === profile.id;

  return (
    <>
      <section className="profile-hero reveal">
        <Avatar url={profile.avatar_url} name={name} size={112} />

        <div className="profile-main">
          <p className="eyebrow">@{profile.username}</p>
          <h1 className="profile-name">{name}</h1>
          {since && <p className="profile-since">{fmt(t.profile.since, { date: since })}</p>}
          {isMe && (
            <p className="profile-own-note">
              {t.profile.ownNote} <Link href="/profile">{t.profile.ownLink}</Link>
            </p>
          )}
        </div>

        <ProfileStats counts={counts} avg={avg} />
      </section>

      <FavoritesRow favorites={favorites} emptyHint={null} />

      <ProfileEntries
        readOnly
        tabs={
          <ProfileTabsNav basePath={`/u/${profile.username}`} tab={tab} counts={counts} />
        }
        empty={
          <div className="empty reveal">
            <p className="empty-title">
              {tab === "all"
                ? t.profile.emptyAll
                : fmt(t.profile.emptyTab, { tab: t.status[tab as WatchStatus] })}
            </p>
          </div>
        }
        entries={shown.map((e) => toProfileEntry(e, locale))}
      />
    </>
  );
}
