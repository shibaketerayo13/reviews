import { createClient } from "@/lib/supabase/server";
import { toIlikePattern } from "@/lib/search";

export type UserHit = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Поиск пользователей по имени на сайте и короткому имени. */
export async function searchUsers(q: string, limit = 4): Promise<UserHit[]> {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const pattern = toIlikePattern(term);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .not("username", "is", null)
    .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
    .order("username", { ascending: true })
    .limit(limit);
  return (data ?? []) as UserHit[];
}
