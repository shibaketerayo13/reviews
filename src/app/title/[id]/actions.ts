"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { cleanEntry, deleteEntry, upsertEntry } from "@/lib/entries";
import { STATUS_LABEL } from "@/lib/types";

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

  const requested = formData.get("status");
  const entry = cleanEntry({
    titleId,
    status: requested,
    score: formData.get("score"),
    review: formData.get("review"),
  });
  if (typeof entry === "string") back(titleId, "error", entry);

  const error = await upsertEntry(user.id, entry);
  if (error) back(titleId, "error", `Не удалось сохранить: ${error}`);

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(
    titleId,
    "message",
    requested === "planned" && entry.status === "watched"
      ? `Оценка сохранена, фильм перенесён в «${STATUS_LABEL.watched}»`
      : "Сохранено в профиле",
  );
}

/** Убрать фильм из профиля целиком. */
export async function deleteRating(formData: FormData) {
  const titleId = titleIdFrom(formData);
  const user = await getUser();
  if (!user) redirect("/login");

  await deleteEntry(user.id, titleId);

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(titleId, "message", "Убрано из профиля");
}
