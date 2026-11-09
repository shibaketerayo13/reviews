import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/supabase/fetch";
import type { Profile } from "@/lib/types";

export const getUser = cache(async () => {
  const supabase = await createClient();
  // Если Supabase не отвечает, считаем посетителя гостем, а не вешаем страницу
  const res = await withTimeout(supabase.auth.getUser(), 5000, null);
  return res?.data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile?.is_admin) redirect("/");
  return profile;
}
