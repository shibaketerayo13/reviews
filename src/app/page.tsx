import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth";
import { getTitleStats } from "@/lib/catalog";
import { TitleGrid } from "@/components/TitleCard";
import { posterUrl } from "@/lib/tmdb";
import { MEDIA_LABEL, yearOf, type Title } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: latest, error } = await supabase
    .from("titles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(18);

  if (error) {
    return (
      <section className="panel">
        <h2>База ещё не настроена</h2>
        <p>
          Не найдена таблица каталога. Выполните файл{" "}
          <code>supabase/schema.sql</code> в Supabase → SQL Editor.
        </p>
        <p className="muted small-text">{error.message}</p>
      </section>
    );
  }

  const titles = (latest ?? []) as Title[];

  if (titles.length === 0) {
    const profile = await getProfile();
    return (
      <section className="page-head reveal">
        <p className="eyebrow">Каталог</p>
        <h1>Пока пусто</h1>
        {profile?.is_admin ? (
          <p className="lead">
            Добавьте фильмы и сериалы в <Link href="/admin">админке</Link>.
          </p>
        ) : (
          <p className="lead">Скоро здесь появятся фильмы и сериалы.</p>
        )}
      </section>
    );
  }

  // Герой: случайный фильм из десятка лучших по рейтингу TMDB, у которого есть кадр
  const [{ data: featuredPool }, { data: top }, user] = await Promise.all([
    supabase
      .from("titles")
      .select("*")
      .not("backdrop_path", "is", null)
      .order("tmdb_rating", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("title_stats")
      .select("title_id")
      .gte("ratings_count", 1)
      .order("avg_score", { ascending: false })
      .order("ratings_count", { ascending: false })
      .limit(12),
    getUser(),
  ]);
  const pool = (featuredPool ?? []) as Title[];
  const featured = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;

  const topIds = (top ?? []).map((r) => r.title_id as number);
  const { data: topRows } = topIds.length
    ? await supabase.from("titles").select("*").in("id", topIds)
    : { data: [] };
  const topTitles = topIds
    .map((id) => (topRows as Title[]).find((t) => t.id === id))
    .filter((t): t is Title => Boolean(t));

  const stats = await getTitleStats([...titles.map((t) => t.id), ...topIds]);
  const backdrop = featured ? posterUrl(featured.backdrop_path, "w1280") : null;

  return (
    <>
      <section className="hero">
        {backdrop && (
          <div className="hero-backdrop" aria-hidden="true">
            <Image src={backdrop} alt="" fill priority sizes="100vw" />
          </div>
        )}
        <div className="hero-content">
          <p className="eyebrow reveal" style={{ "--i": 0 } as React.CSSProperties}>
            Дневник кино и сериалов
          </p>
          <h1 className="hero-title reveal" style={{ "--i": 1 } as React.CSSProperties}>
            Всё, что вы посмотрели, <em>в одном месте</em>
          </h1>
          <p className="lead reveal" style={{ "--i": 2 } as React.CSSProperties}>
            Отмечайте просмотренное, ставьте оценки, пишите пару слов на память
            и собирайте список на потом.
          </p>
          <div className="hero-actions reveal" style={{ "--i": 3 } as React.CSSProperties}>
            {user ? (
              <Link href="/profile" className="button">
                Мой профиль
              </Link>
            ) : (
              <Link href="/login" className="button">
                Создать аккаунт
              </Link>
            )}
            <Link href="#catalog" className="button button-ghost">
              Смотреть каталог
            </Link>
          </div>
        </div>
        {featured && (
          <Link
            href={`/title/${featured.id}`}
            className="hero-caption reveal"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            <span className="muted">В кадре</span> {featured.title}
            <span className="muted">
              {" "}
              · {MEDIA_LABEL[featured.media_type]} {yearOf(featured.release_date)}
            </span>
          </Link>
        )}
      </section>

      {topTitles.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Высокие оценки</h2>
            <span className="section-note">по мнению пользователей сайта</span>
          </div>
          <TitleGrid titles={topTitles} stats={stats} />
        </section>
      )}

      <section id="catalog">
        <div className="section-head">
          <h2>Новое в каталоге</h2>
          <Link href="/search" className="section-link">
            Поиск по каталогу →
          </Link>
        </div>
        <TitleGrid titles={titles} stats={stats} />
      </section>
    </>
  );
}
