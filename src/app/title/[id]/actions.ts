"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isWatchStatus } from "@/lib/types";

function titleIdFrom(formData: FormData): number {
  const id = Number(formData.get("title_id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/");
  return id;
}

function back(titleId: number, key: "message" | "error", text: string): never {
  redirect(`/title/${titleId}?${key}=${encodeURIComponent(text)}`);
}

/** Добавить в профиль или обновить: статус, необязательная оценка и комментарий. */
export async function saveRating(formData: FormData) {
  const titleId = titleIdFrom(formData);
  const user = await getUser();
  if (!user) redirect("/login");

  const status = formData.get("status");
  if (!isWatchStatus(status)) back(titleId, "error", "Выберите статус");

  const rawScore = formData.get("score");
  let score: number | null = null;
  if (rawScore !== null && rawScore !== "") {
    score = Number(rawScore);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      back(titleId, "error", "Оценка должна быть от 1 до 10");
    }
  }

  const rawReview = formData.get("review");
  const review =
    typeof rawReview === "string" && rawReview.trim()
      ? rawReview.trim().slice(0, 5000)
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: user.id,
      title_id: titleId,
      status,
      score,
      review,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title_id" },
  );
  if (error) back(titleId, "error", `Не удалось сохранить: ${error.message}`);

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(titleId, "message", "Сохранено в профиле");
}

/** Убрать фильм из профиля целиком. */
export async function deleteRating(formData: FormData) {
  const titleId = titleIdFrom(formData);
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  await supabase
    .from("ratings")
    .delete()
    .eq("user_id", user.id)
    .eq("title_id", titleId);

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(titleId, "message", "Убрано из профиля");
}
