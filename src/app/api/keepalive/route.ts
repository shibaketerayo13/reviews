// Ежедневный «пульс» для Supabase: бесплатный проект засыпает после нескольких дней без запросов.
// Vercel вызывает этот адрес по расписанию из vercel.json (раз в сутки).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/lib/supabase/fetch";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Если в Vercel задан CRON_SECRET, Vercel присылает его в заголовке — чужие вызовы отклоняем
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "no env" }, { status: 500 });

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(10000) },
  });
  const started = Date.now();
  // Лёгкий запрос к базе: одна строка каталога
  const { error } = await supabase.from("titles").select("id").limit(1);
  const ms = Date.now() - started;

  if (error) {
    console.error("[keepalive] Supabase не ответил:", error.message);
    return NextResponse.json({ ok: false, error: error.message, ms }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ms, at: new Date().toISOString() });
}
