"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

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
