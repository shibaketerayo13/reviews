"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

function titleIdFrom(formData: FormData): number {
  const id = Number(formData.get("title_id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/");
  return id;
}

export async function saveRating(formData: FormData) {
  const titleId = titleIdFrom(formData);
  const user = await getUser();
  if (!user) redirect("/login");

  const score = Number(formData.get("score"));
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    redirect(`/title/${titleId}?error=` + encodeURIComponent("Выберите оценку от 1 до 10"));
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
      score,
      review,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title_id" },
  );
  if (error) {
    redirect(`/title/${titleId}?error=` + encodeURIComponent("Не удалось сохранить оценку"));
  }

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  redirect(`/title/${titleId}?message=` + encodeURIComponent("Оценка сохранена"));
}

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
  redirect(`/title/${titleId}?message=` + encodeURIComponent("Оценка удалена"));
}
