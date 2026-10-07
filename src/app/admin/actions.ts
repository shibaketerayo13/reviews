"use server";

// Действия админки. Права проверяются здесь и ещё раз в базе (RLS: только is_admin).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  getDetails,
  getPopular,
  getTrending,
  isMediaType,
  toTitleRow,
  type MediaType,
} from "@/lib/tmdb";
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

/** Импорт популярного или трендового из TMDB (20 штук за раз). */
export async function importList(formData: FormData) {
  await assertAdmin();
  const mediaType = formData.get("media_type");
  const source = formData.get("source");
  if (!isMediaType(mediaType) || (source !== "popular" && source !== "trending")) {
    done("/admin", "error", "Неверные данные");
  }

  const rows = await (source === "popular" ? getPopular(mediaType) : getTrending(mediaType))
    .then((list) => list.results.map((m) => toTitleRow(mediaType, m)))
    .catch(() => null);
  if (!rows) done("/admin", "error", "Не удалось получить список из TMDB");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("titles")
    .upsert(rows, { onConflict: "media_type,tmdb_id", ignoreDuplicates: true })
    .select("id");
  if (error) done("/admin", "error", `Ошибка базы: ${error.message}`);

  revalidatePath("/");
  done("/admin", "message", `Импортировано новых: ${data?.length ?? 0} из ${rows.length}`);
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
