"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cleanEntry, deleteEntry, upsertEntry } from "@/lib/entries";

const BUCKET = "avatars";

export async function updateDisplayName(formData: FormData) {
  const user = await requireUser();
  const raw = formData.get("display_name");
  const name = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!name) redirect("/profile?error=" + encodeURIComponent("Имя не может быть пустым"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) {
    redirect("/profile?error=" + encodeURIComponent("Не удалось сохранить имя"));
  }

  revalidatePath("/", "layout");
  redirect("/profile?message=" + encodeURIComponent("Имя сохранено"));
}

type Result = { ok: true } | { ok: false; error: string };

/** Удаляет из папки пользователя все файлы, кроме keep. */
async function cleanupFolder(userId: string, keep?: string) {
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(BUCKET).list(userId);
  const stale = (files ?? [])
    .map((f) => `${userId}/${f.name}`)
    .filter((path) => path !== keep);
  if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
}

/**
 * Сохраняет ссылку на уже загруженный аватар.
 * Файл загружается из браузера прямо в Supabase Storage (в свою папку),
 * а здесь проверяем, что ссылка ведёт именно туда.
 */
export async function setAvatar(path: string): Promise<Result> {
  const user = await requireUser();
  const prefix = `${user.id}/`;
  if (
    typeof path !== "string" ||
    !path.startsWith(prefix) ||
    path.includes("..") ||
    !/^[\w-]+\/[\w.-]+$/.test(path)
  ) {
    return { ok: false, error: "Неверный файл" };
  }

  const supabase = await createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Не удалось сохранить аватар" };

  await cleanupFolder(user.id, path);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Не удалось удалить аватар" };

  await cleanupFolder(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Редактирование записей прямо в профиле ---------- */

export type EntryResult =
  | { ok: true; status: "watched" | "planned" | "dropped"; moved: boolean }
  | { ok: false; error: string };

export async function updateEntry(input: {
  titleId: number;
  status: string;
  score: number | null;
  review: string;
}): Promise<EntryResult> {
  const user = await requireUser();
  const entry = cleanEntry(input);
  if (typeof entry === "string") return { ok: false, error: entry };

  const error = await upsertEntry(user.id, entry);
  if (error) return { ok: false, error: `Не удалось сохранить: ${error}` };

  revalidatePath("/profile");
  revalidatePath(`/title/${entry.titleId}`);
  return { ok: true, status: entry.status, moved: input.status !== entry.status };
}

export async function removeEntry(titleId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const id = Number(titleId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Неверный фильм" };
  const error = await deleteEntry(user.id, id);
  if (error) return { ok: false, error: "Не удалось удалить" };
  revalidatePath("/profile");
  revalidatePath(`/title/${id}`);
  return { ok: true };
}

/* ---------- Любимые ---------- */

/**
 * Отметить или снять «любимое». Статус при этом не теряется.
 * Если фильма ещё нет в профиле, он добавляется как «Просмотрено».
 * Любимый фильм из «Посмотреть позже» переносится в «Просмотрено».
 */
export async function toggleFavorite(
  titleId: number,
  value: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const id = Number(titleId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Неверный фильм" };
  const on = value === true;
  const now = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ratings")
    .update({ is_favorite: on, favorited_at: on ? now : null })
    .eq("user_id", user.id)
    .eq("title_id", id)
    .select("title_id");
  if (error) return { ok: false, error: "Не удалось сохранить" };

  if (!data?.length && on) {
    const { error: insertError } = await supabase.from("ratings").insert({
      user_id: user.id,
      title_id: id,
      status: "watched",
      is_favorite: true,
      favorited_at: now,
      updated_at: now,
    });
    if (insertError) return { ok: false, error: "Не удалось сохранить" };
  } else if (on) {
    await supabase
      .from("ratings")
      .update({ status: "watched" })
      .eq("user_id", user.id)
      .eq("title_id", id)
      .eq("status", "planned");
  }

  revalidatePath("/profile");
  revalidatePath(`/title/${id}`);
  return { ok: true };
}

/* ---------- Короткое имя для ссылки на профиль ---------- */

export async function updateUsername(formData: FormData) {
  const user = await requireUser();
  const raw = formData.get("username");
  const username = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect(
      "/profile?error=" +
        encodeURIComponent("Короткое имя: 3–30 символов, латиница, цифры и «_»"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);
  if (error) {
    redirect(
      "/profile?error=" +
        encodeURIComponent(
          error.code === "23505" ? "Это имя уже занято" : "Не удалось сохранить имя",
        ),
    );
  }

  revalidatePath("/", "layout");
  redirect("/profile?message=" + encodeURIComponent(`Ваш профиль теперь по адресу /u/${username}`));
}
