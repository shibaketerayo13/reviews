"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";

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
  const { t } = await getI18n();
  if (!email || !password) back({ error: t.login.needEmailPassword });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    back({
      error:
        error.message === "Email not confirmed"
          ? t.login.emailNotConfirmed
          : t.login.wrongCredentials,
    });
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function signup(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const displayName = field(formData, "display_name");
  const { t } = await getI18n();
  if (!email || !password) back({ error: t.login.needEmailPassword });
  if (password.length < 6) back({ error: t.login.passwordTooShort });

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
  if (error) back({ error: fmt(t.login.signupFailed, { error: error.message }) });

  // Если в Supabase включено подтверждение почты, сессии ещё нет
  if (!data.session) {
    back({ message: t.login.checkEmail });
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
