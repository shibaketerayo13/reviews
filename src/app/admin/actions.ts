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

/** Выполняет задачи по несколько штук одновременно, чтобы не упереться в лимиты TMDB. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
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
