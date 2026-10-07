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
import { STATUS_LABEL, isWatchStatus, type WatchStatus } from "@/lib/types";

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
  const p = await findProfile(username);
  if (!p) return { title: "Профиль не найден · reviews" };
  const name = p.display_name ?? p.username;
  return {
    title: `${name} · reviews`,
    description: `Фильмы и сериалы, которые посмотрел(а) ${name}, с оценками и отзывами`,
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
  const [viewer, data] = await Promise.all([getUser(), loadProfileData(profile.id)]);
  const { all, counts, avg, favorites } = data;
  const shown = tab === "all" ? all : all.filter((e) => e.status === tab);
  const name = profile.display_name ?? profile.username;
  const since = formatSince(profile.created_at);
  const isMe = viewer?.id === profile.id;

  return (
    <>
      <section className="profile-hero reveal">
        <Avatar url={profile.avatar_url} name={name} size={112} />

        <div className="profile-main">
          <p className="eyebrow">@{profile.username}</p>
          <h1 className="profile-name">{name}</h1>
          {since && <p className="profile-since">На сайте с {since}</p>}
          {isMe && (
            <p className="profile-own-note">
              Так ваш профиль видят другие.{" "}
              <Link href="/profile">Перейти к редактированию →</Link>
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
                ? "Здесь пока пусто"
                : `В разделе «${STATUS_LABEL[tab as WatchStatus]}» ничего нет`}
            </p>
          </div>
        }
        entries={shown.map(toProfileEntry)}
      />
    </>
  );
}
