import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { existingKeys } from "@/lib/catalog";
import { searchMovieTv, type TmdbSearchItem } from "@/lib/tmdb";
import { TmdbResults } from "@/components/TmdbResults";
import { MEDIA_LABEL, yearOf, type Title } from "@/lib/types";
import { botToken, botUsername, tg } from "@/lib/telegram/api";
import { connectTelegram, deleteTitle, importImdb, importList, refreshTitle } from "./actions";

export const metadata = { title: "Админка · reviews" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { q: rawQ = "", error, message } = await searchParams;
  const q = rawQ.trim().slice(0, 100);

  const supabase = await createClient();
  const [{ count: total }, { data: recent }] = await Promise.all([
    supabase.from("titles").select("id", { count: "exact", head: true }),
    supabase
      .from("titles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let results: TmdbSearchItem[] = [];
  let inCatalog = new Set<string>();
  let searchError: string | null = null;
  if (q) {
    try {
      results = await searchMovieTv(q);
      inCatalog = await existingKeys(results);
    } catch (e) {
      searchError = e instanceof Error ? e.message : String(e);
    }
  }
  const missing = results.filter((r) => !inCatalog.has(`${r.media_type}:${r.id}`));

  const bot = botUsername();
  const webhook = botToken()
    ? await tg<{ url: string; last_error_message?: string }>("getWebhookInfo").catch(() => null)
    : null;
  const alreadyCount = results.length - missing.length;

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <h1>Админка</h1>
      <p className="muted">В каталоге: {total ?? 0}</p>

      <section className="panel">
        <h2>Докачать из TMDB</h2>
        <form action="/admin" className="inline-form">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Название фильма или сериала"
          />
          <button type="submit">Найти в TMDB</button>
        </form>
        {searchError && <p className="notice error">{searchError}</p>}
        {q && !searchError && (
          <>
            {alreadyCount > 0 && (
              <p className="muted small-text">
                Уже в каталоге: {alreadyCount}
              </p>
            )}
            {missing.length > 0 ? (
              <TmdbResults
                items={missing}
                isAdmin
                returnTo={`/admin?q=${encodeURIComponent(q)}`}
              />
            ) : (
              <p className="muted">Нечего добавлять.</p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Telegram-бот</h2>
        {!botToken() || !bot ? (
          <p className="muted small-text">
            Бот не настроен: добавьте в Vercel переменные TELEGRAM_BOT_TOKEN,
            TELEGRAM_BOT_USERNAME и SUPABASE_SERVICE_ROLE_KEY и сделайте Redeploy.
          </p>
        ) : (
          <>
            <p className="muted small-text">
              Бот <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">@{bot}</a>.{" "}
              {webhook?.url
                ? `Подключён: ${webhook.url}`
                : "Ещё не подключён: нажмите кнопку, чтобы Telegram начал присылать сообщения на сайт."}
              {webhook?.last_error_message && ` Последняя ошибка: ${webhook.last_error_message}`}
            </p>
            <form action={connectTelegram} className="inline-form">
              <button type="submit">{webhook?.url ? "Переподключить" : "Подключить бота"}</button>
            </form>
          </>
        )}
      </section>

      <section className="panel">
        <h2>IMDb Top 250</h2>
        <p className="muted small-text">
          Лучшие фильмы и сериалы по версии IMDb (снимок списков от
          07.10.2026). Каждая позиция ищется в TMDB по IMDb ID. Повторы не
          добавляются, кнопку можно нажимать сколько угодно раз. Импорт 250
          позиций занимает около минуты.
        </p>
        <form action={importImdb} className="inline-form">
          <select name="preset" defaultValue="top" aria-label="Список">
            <option value="top">Фильмы</option>
            <option value="top_tv">Сериалы</option>
          </select>
          <select name="limit" defaultValue="250" aria-label="Сколько">
            <option value="50">Топ 50</option>
            <option value="100">Топ 100</option>
            <option value="200">Топ 200</option>
            <option value="250">Топ 250</option>
          </select>
          <button type="submit">Импортировать</button>
        </form>
      </section>

      <section className="panel">
        <h2>Импорт из списков TMDB</h2>
        <p className="muted small-text">
          Одна страница содержит 20 позиций. Повторы не добавляются: при
          повторном импорте попадут только новые фильмы.
        </p>
        <form action={importList} className="inline-form">
          <select name="source" defaultValue="top_rated" aria-label="Список">
            <option value="top_rated">Лучшие по рейтингу</option>
            <option value="popular">Популярные</option>
            <option value="trending">Тренды недели</option>
          </select>
          <select name="media_type" defaultValue="movie" aria-label="Тип">
            <option value="movie">Фильмы</option>
            <option value="tv">Сериалы</option>
          </select>
          <select name="pages" defaultValue="5" aria-label="Сколько">
            <option value="1">20 шт.</option>
            <option value="5">100 шт.</option>
            <option value="10">200 шт.</option>
            <option value="25">500 шт.</option>
          </select>
          <button type="submit">Импортировать</button>
        </form>
      </section>

      <section className="panel">
        <h2>Импорт по списку IMDb ID</h2>
        <p className="muted small-text">
          Вставьте любой текст со ссылками или номерами вида tt0111161 (до
          500 штук), например скопированный список с IMDb.
        </p>
        <form action={importImdb} className="form">
          <textarea
            name="ids"
            rows={4}
            placeholder="https://www.imdb.com/title/tt0111161/&#10;tt0068646"
          />
          <button type="submit">Импортировать</button>
        </form>
      </section>

      <section>
        <h2>Последние добавленные</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Год</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {((recent ?? []) as Title[]).map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/title/${t.id}`}>{t.title}</Link>
                </td>
                <td>{MEDIA_LABEL[t.media_type]}</td>
                <td>{yearOf(t.release_date)}</td>
                <td className="actions">
                  <form action={refreshTitle}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="link-button">
                      Обновить
                    </button>
                  </form>
                  <form action={deleteTitle}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="link-button danger">
                      Удалить
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
