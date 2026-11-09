// Supabase для серверных компонентов, route handlers и server actions.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout } from "./fetch";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Недоступная база не должна вешать страницу до таймаута Vercel
      global: { fetch: fetchWithTimeout(8000) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызов из серверного компонента: запись cookie там недоступна, это нормально.
          }
        },
      },
    },
  );
}
