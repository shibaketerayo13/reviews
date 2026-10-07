// Проверка подключения: откройте http://localhost:3000/api/health
// Секретные значения в ответ не попадают, только статусы.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

async function checkTmdb(): Promise<Check> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return { ok: false, detail: "TMDB_READ_ACCESS_TOKEN не задан" };
  try {
    const res = await fetch("https://api.themoviedb.org/3/configuration", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok
      ? { ok: true, detail: "TMDB отвечает, токен принят" }
      : { ok: false, detail: `TMDB вернул ${res.status}` };
  } catch (e) {
    return { ok: false, detail: `Нет связи с TMDB: ${String(e)}` };
  }
}

async function checkSupabase(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      ok: false,
      detail: "NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY не задан",
    };
  }
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    return res.ok
      ? { ok: true, detail: "Supabase отвечает, ключ принят" }
      : { ok: false, detail: `Supabase вернул ${res.status}` };
  } catch (e) {
    return { ok: false, detail: `Нет связи с Supabase: ${String(e)}` };
  }
}

export async function GET() {
  const [tmdb, supabase] = await Promise.all([checkTmdb(), checkSupabase()]);
  return NextResponse.json(
    { tmdb, supabase },
    { status: tmdb.ok && supabase.ok ? 200 : 503 },
  );
}
