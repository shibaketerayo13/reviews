"use server";

// Действия админки. Права проверяются здесь и ещё раз в базе (RLS: только is_admin).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  findByImdbId,
  getDetails,
  getList,
  isListSource,
  isMediaType,
  toTitleRow,
  type MediaType,
} from "@/lib/tmdb";
import { IMDB_TOP_250 } from "@/data/imdb-top-250";
import { IMDB_TOP_250_TV } from "@/data/imdb-top-250-tv";
import { safeNext, withParam } from "@/lib/redirect";
import { mapLimited } from "@/lib/async";
import { headers } from "next/headers";
import { botToken, tg, webhookSecret } from "@/lib/telegram/api";
import { siteUrl } from "@/lib/telegram/site";

async function assertAdmin() {
  const profile = await getProfile();
  if (!profile?.is_admin) redirect("/");
}

function done(returnTo: string, key: "message" | "error", text: string): never {
  redirect(withParam(returnTo, key, text));
}

/** Добавить один фильм/сериал из TMDB в каталог. */
export async function addTitle(formData: FormData) {
  await assertAdmin();
  const returnTo = safeNext(formData.get("return_to"), "/admin");
  const tmdbId = Number(formData.get("tmdb_id"));
  const mediaType = formData.get("media_type");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !isMediaType(mediaType)) {
    done(returnTo, "error", "Неверные данные");
  }

  const row = await getDetails(mediaType, tmdbId)
    .then((m) => toTitleRow(mediaType, m))
    .catch(() => null);
  if (!row) done(returnTo, "error", "Не удалось получить данные из TMDB");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("titles")
    .upsert(row, { onConflict: "media_type,tmdb_id" })
    .select("id")
    .single();
  if (error) done(returnTo, "error", `Ошибка базы: ${error.message}`);

  revalidatePath("/");
  done(returnTo, "message", `Добавлено: «${row.title}» (/title/${data.id})`);
}

type TitleRow = ReturnType<typeof toTitleRow>;

/** Вставляет только новые строки: повторы (тот же тип + tmdb_id) пропускаются. */
async function insertNew(rows: TitleRow[]): Promise<number> {
  const unique = [
    ...new Map(rows.map((r) => [`${r.media_type}:${r.tmdb_id}`, r])).values(),
  ];
  if (unique.length === 0) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("titles")
    .upsert(unique, { onConflict: "media_type,tmdb_id", ignoreDuplicates: true })
    .select("id");
  if (error) done("/admin", "error", `Ошибка базы: ${error.message}`);
  return data?.length ?? 0;
}

/** Импорт списка TMDB: популярное, трендовое или лучшее по рейтингу, N страниц по 20. */
export async function importList(formData: FormData) {
  await assertAdmin();
  const mediaType = formData.get("media_type");
  const source = formData.get("source");
  const pages = Math.min(Math.max(Number(formData.get("pages")) || 1, 1), 25);
  if (!isMediaType(mediaType) || !isListSource(source)) {
    done("/admin", "error", "Неверные данные");
  }

  const lists = await mapLimited(
    Array.from({ length: pages }, (_, i) => i + 1),
    5,
    (page) => getList(mediaType, source, page).catch(() => null),
  );
  const rows = lists
    .flatMap((l) => l?.results ?? [])
    .map((m) => toTitleRow(mediaType, m));
  if (rows.length === 0) done("/admin", "error", "Не удалось получить список из TMDB");

  const added = await insertNew(rows);
  revalidatePath("/");
  done(
    "/admin",
    "message",
    `Получено из TMDB: ${rows.length}. Новых добавлено: ${added}, остальные уже были в каталоге.`,
  );
}

/** Импорт по IMDb ID: готовый IMDb Top 250 или свой список tt-номеров. */
export async function importImdb(formData: FormData) {
  await assertAdmin();

  let ids: string[];
  const preset = formData.get("preset");
  if (preset === "top" || preset === "top_tv") {
    const limit = Math.min(Math.max(Number(formData.get("limit")) || 250, 1), 250);
    ids = (preset === "top" ? IMDB_TOP_250 : IMDB_TOP_250_TV).slice(0, limit);
  } else {
    const text = String(formData.get("ids") ?? "");
    ids = [...new Set(text.match(/tt\d{7,9}/g) ?? [])].slice(0, 500);
  }
  if (ids.length === 0) done("/admin", "error", "Не найдено ни одного IMDb ID вида tt1234567");

  const found = await mapLimited(ids, 8, async (id) => {
    try {
      const hit = await findByImdbId(id);
      return hit ? toTitleRow(hit.type, hit.media) : null;
    } catch {
      return null;
    }
  });
  const rows = found.filter((r): r is TitleRow => r !== null);
  const missing = ids.length - rows.length;

  const added = await insertNew(rows);
  revalidatePath("/");
  done(
    "/admin",
    "message",
    `IMDb ID: ${ids.length}. Найдено в TMDB: ${rows.length}` +
      (missing ? ` (не найдено: ${missing})` : "") +
      `. Новых добавлено: ${added}, остальные уже были в каталоге.`,
  );
}

/** Обновить данные тайтла из TMDB (описание, постер, рейтинг). */
export async function refreshTitle(formData: FormData) {
  await assertAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();
  const { data: title } = await supabase
    .from("titles")
    .select("tmdb_id, media_type")
    .eq("id", id)
    .maybeSingle();
  if (!title || !isMediaType(title.media_type)) done("/admin", "error", "Не найдено");

  const mediaType = title.media_type as MediaType;
  const row = await getDetails(mediaType, Number(title.tmdb_id))
    .then((m) => toTitleRow(mediaType, m))
    .catch(() => null);
  if (!row) done("/admin", "error", "Не удалось получить данные из TMDB");
  const { error } = await supabase.from("titles").update(row).eq("id", id);
  if (error) done("/admin", "error", `Ошибка базы: ${error.message}`);

  revalidatePath(`/title/${id}`);
  done("/admin", "message", `Обновлено: «${row.title}»`);
}

/** Удалить тайтл из каталога (вместе с оценками к нему). */
export async function deleteTitle(formData: FormData) {
  await assertAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) done("/admin", "error", "Неверные данные");

  const supabase = await createClient();
  const { error } = await supabase.from("titles").delete().eq("id", id);
  if (error) done("/admin", "error", `Ошибка базы: ${error.message}`);

  revalidatePath("/");
  done("/admin", "message", "Удалено из каталога");
}

/** Подключить Telegram-бота: сказать Telegram, куда присылать сообщения. */
export async function connectTelegram() {
  await assertAdmin();
  if (!botToken()) done("/admin", "error", "Не задан TELEGRAM_BOT_TOKEN в переменных окружения");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    done("/admin", "error", "Не задан SUPABASE_SERVICE_ROLE_KEY в переменных окружения");
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const url = `${siteUrl(origin)}/api/telegram/webhook`;
  if (!url.startsWith("https://")) {
    done("/admin", "error", `Telegram принимает только https-адреса, а сейчас ${url}. Подключайте на сайте Vercel.`);
  }

  try {
    await tg("setWebhook", {
      url,
      secret_token: webhookSecret(),
      allowed_updates: ["message", "callback_query"],
    });
    await tg("setMyCommands", {
      commands: [
        { command: "help", description: "Как пользоваться" },
        { command: "unlink", description: "Отвязать Telegram от аккаунта" },
      ],
    });
    await tg("setMyDescription", {
      description:
        "Бот сайта reviews: пришлите название фильма или сериала, и я найду его на сайте, " +
        "добавлю из TMDB, если его нет, и помогу поставить оценку.",
    });
  } catch (e) {
    done("/admin", "error", e instanceof Error ? e.message : "Не удалось подключить бота");
  }
  done("/admin", "message", `Бот подключён: ${url}`);
}

/** Заменить фильм в каталоге на другой из TMDB (исправление неверного совпадения). */
export async function replaceTitle(formData: FormData) {
  await assertAdmin();
  const titleId = Number(formData.get("title_id"));
  const tmdbId = Number(formData.get("tmdb_id"));
  const mediaType = formData.get("media_type");
  const back = `/title/${titleId}`;
  if (!Number.isInteger(titleId) || titleId <= 0) redirect("/admin");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !isMediaType(mediaType)) {
    done(back, "error", "Неверные данные");
  }

  const row = await getDetails(mediaType, tmdbId)
    .then((m) => toTitleRow(mediaType, m))
    .catch(() => null);
  if (!row) done(back, "error", "Не удалось получить данные из TMDB");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_replace_title", {
    p_title_id: titleId,
    p_row: row,
  });
  if (error) done(back, "error", `Не удалось заменить: ${error.message}`);

  const newId = Number(data);
  revalidatePath("/", "layout");
  done(`/title/${newId}`, "message", `Заменено на «${row.title}». Оценки сохранены.`);
}
