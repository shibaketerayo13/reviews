import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getTitleStats } from "@/lib/catalog";
import { TitleGrid } from "@/components/TitleCard";
import type { Title } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: latest, error } = await supabase
    .from("titles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

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

  // Лучшие по оценкам пользователей сайта
  const { data: top } = await supabase
    .from("title_stats")
    .select("title_id")
    .gte("ratings_count", 1)
    .order("avg_score", { ascending: false })
    .order("ratings_count", { ascending: false })
    .limit(12);
  const topIds = (top ?? []).map((r) => r.title_id as number);
  const { data: topRows } = topIds.length
    ? await supabase.from("titles").select("*").in("id", topIds)
    : { data: [] };
  const topTitles = topIds
    .map((id) => (topRows as Title[]).find((t) => t.id === id))
    .filter((t): t is Title => Boolean(t));

  const stats = await getTitleStats([
    ...titles.map((t) => t.id),
    ...topIds,
  ]);

  if (titles.length === 0) {
    const profile = await getProfile();
    return (
      <section className="panel">
        <h2>Каталог пока пуст</h2>
        {profile?.is_admin ? (
          <p>
            Добавьте фильмы и сериалы в <Link href="/admin">админке</Link>:
            найдите нужное в TMDB или импортируйте популярное одной кнопкой.
          </p>
        ) : (
          <p>Скоро здесь появятся фильмы и сериалы.</p>
        )}
      </section>
    );
  }

  return (
    <>
      {topTitles.length > 0 && (
        <section>
          <h2>Высокие оценки</h2>
          <TitleGrid titles={topTitles} stats={stats} />
        </section>
      )}
      <section>
        <h2>Новое в каталоге</h2>
        <TitleGrid titles={titles} stats={stats} />
      </section>
    </>
  );
}
