"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function back(params: Record<string, string>): never {
  redirect(`/login?${new URLSearchParams(params).toString()}`);
}

export async function login(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  if (!email || !password) back({ error: "Введите email и пароль" });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    back({
      error:
        error.message === "Email not confirmed"
          ? "Email не подтверждён: откройте ссылку из письма"
          : "Неверный email или пароль",
    });
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function signup(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const displayName = field(formData, "display_name");
  if (!email || !password) back({ error: "Введите email и пароль" });
  if (password.length < 6) back({ error: "Пароль должен быть не короче 6 символов" });

  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) back({ error: `Не удалось зарегистрироваться: ${error.message}` });

  // Если в Supabase включено подтверждение почты, сессии ещё нет
  if (!data.session) {
    back({ message: "Мы отправили письмо. Откройте ссылку из него, чтобы завершить регистрацию." });
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
