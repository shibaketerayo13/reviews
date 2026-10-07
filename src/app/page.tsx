import Image from "next/image";
import {
  getTrendingMovies,
  getTrendingTv,
  posterUrl,
  type TmdbMedia,
} from "@/lib/tmdb";

// Страница рендерится на сервере при каждом запросе, чтобы без ключей
// сборка не падала, а показывала понятное сообщение.
export const dynamic = "force-dynamic";

function MediaGrid({ title, items }: { title: string; items: TmdbMedia[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="grid">
        {items.slice(0, 12).map((item) => {
          const poster = posterUrl(item.poster_path);
          const name = item.title ?? item.name ?? "Без названия";
          return (
            <article key={item.id} className="card">
              {poster ? (
                <Image src={poster} alt={name} width={300} height={450} />
              ) : (
                <div className="no-poster">нет постера</div>
              )}
              <h3>{name}</h3>
              <p className="rating">★ {item.vote_average.toFixed(1)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default async function HomePage() {
  try {
    const [movies, tv] = await Promise.all([
      getTrendingMovies(),
      getTrendingTv(),
    ]);
    return (
      <>
        <MediaGrid title="Фильмы недели" items={movies.results} />
        <MediaGrid title="Сериалы недели" items={tv.results} />
      </>
    );
  } catch (error) {
    return (
      <section>
        <h2>Не удалось загрузить данные из TMDB</h2>
        <p>{error instanceof Error ? error.message : "Неизвестная ошибка"}</p>
        <p>
          Проверьте файл <code>.env.local</code> и откройте{" "}
          <a href="/api/health">/api/health</a>.
        </p>
      </section>
    );
  }
}
