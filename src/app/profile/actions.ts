"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

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
