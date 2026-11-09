"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { cleanEntry, deleteEntry, upsertEntry } from "@/lib/entries";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";

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
  const { t } = await getI18n();

  const requested = formData.get("status");
  const entry = cleanEntry({
    titleId,
    status: requested,
    score: formData.get("score"),
    review: formData.get("review"),
  });
  if (typeof entry === "string") back(titleId, "error", t.errors[entry]);

  const error = await upsertEntry(user.id, entry);
  if (error) back(titleId, "error", fmt(t.errors.saveFailed, { error }));

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(
    titleId,
    "message",
    requested === "planned" && entry.status === "watched"
      ? fmt(t.entry.movedToWatched, { status: t.status.watched })
      : t.entry.saved,
  );
}

/** Убрать фильм из профиля целиком. */
export async function deleteRating(formData: FormData) {
  const titleId = titleIdFrom(formData);
  const user = await getUser();
  if (!user) redirect("/login");

  await deleteEntry(user.id, titleId);
  const { t } = await getI18n();

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  back(titleId, "message", t.entry.removed);
}
