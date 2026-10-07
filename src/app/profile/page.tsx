import Link from "next/link";
import Image from "next/image";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { posterUrl } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf, type Title } from "@/lib/types";
import { updateDisplayName } from "./actions";

export const metadata = { title: "Профиль · reviews" };

type RatingRow = {
  score: number;
  review: string | null;
  updated_at: string;
  titles: Pick<Title, "id" | "title" | "media_type" | "poster_path" | "release_date"> | null;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  const { error, message } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ratings")
    .select("score, review, updated_at, titles(id, title, media_type, poster_path, release_date)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const ratings = ((data ?? []) as unknown as RatingRow[]).filter((r) => r.titles);
  const avg =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
      : null;

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
            Оценок: <strong>{ratings.length}</strong>
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

      <section>
        <h2>Мои оценки</h2>
        {ratings.length === 0 ? (
          <p className="muted">
            Вы ещё ничего не оценили. Найдите фильм через <Link href="/search">поиск</Link>.
          </p>
        ) : (
          <ul className="rating-list">
            {ratings.map((r) => {
              const t = r.titles!;
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
                  <div>
                    <Link href={`/title/${t.id}`}>
                      <strong>{t.title}</strong>
                    </Link>{" "}
                    <span className="muted">
                      {MEDIA_LABEL[t.media_type]} {yearOf(t.release_date)}
                    </span>
                    <p className="score">★ {r.score}/10</p>
                    {r.review && <p className="review-text">{r.review}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
