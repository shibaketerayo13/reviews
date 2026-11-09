// Сохранение записи «фильм в профиле»: общая логика для страницы фильма и профиля.
import { createClient } from "@/lib/supabase/server";
import { isWatchStatus, type WatchStatus } from "@/lib/types";

export type EntryInput = {
  titleId: unknown;
  status: unknown;
  score: unknown;
  review: unknown;
};

export type CleanEntry = {
  titleId: number;
  status: WatchStatus;
  score: number | null;
  review: string | null;
};

/** Код ошибки ввода: текст берётся из словаря (t.errors[код]). */
export type EntryError = "badTitle" | "pickStatus" | "badScore";

/** Проверяет ввод. Возвращает код ошибки или нормализованную запись. */
export function cleanEntry(input: EntryInput): CleanEntry | EntryError {
  const titleId = Number(input.titleId);
  if (!Number.isInteger(titleId) || titleId <= 0) return "badTitle";
  if (!isWatchStatus(input.status)) return "pickStatus";

  let score: number | null = null;
  if (input.score !== null && input.score !== undefined && input.score !== "") {
    score = Number(input.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return "badScore";
    }
  }

  const review =
    typeof input.review === "string" && input.review.trim()
      ? input.review.trim().slice(0, 5000)
      : null;

  // Оценка у фильма «на потом» означает, что его уже посмотрели
  const status: WatchStatus = score !== null && input.status === "planned" ? "watched" : input.status;

  return { titleId, status, score, review };
}

export async function upsertEntry(userId: string, e: CleanEntry): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      title_id: e.titleId,
      status: e.status,
      score: e.score,
      review: e.review,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title_id" },
  );
  return error ? error.message : null;
}

export async function deleteEntry(userId: string, titleId: number): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ratings")
    .delete()
    .eq("user_id", userId)
    .eq("title_id", titleId);
  return error ? error.message : null;
}
