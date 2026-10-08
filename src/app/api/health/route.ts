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

/** Какой ключ лежит в SUPABASE_SERVICE_ROLE_KEY (без самого значения). */
function serviceKeyKind(key: string): "secret" | "public" | "unknown" {
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "public";
  const payload = key.split(".")[1];
  if (payload) {
    try {
      const role = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
      if (role === "service_role") return "secret";
      if (role === "anon") return "public";
    } catch {
      /* не JWT */
    }
  }
  return "unknown";
}

async function checkTelegramBot(): Promise<Check> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) return { ok: false, detail: "TELEGRAM_BOT_TOKEN не задан" };
  if (!process.env.TELEGRAM_BOT_USERNAME) return { ok: false, detail: "TELEGRAM_BOT_USERNAME не задан" };
  if (!key) return { ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY не задан" };

  const kind = serviceKeyKind(key);
  if (kind === "public") {
    return {
      ok: false,
      detail:
        "В SUPABASE_SERVICE_ROLE_KEY вставлен публичный ключ (publishable/anon). " +
        "Нужен ключ из блока Secret keys (sb_secret_…) или legacy service_role.",
    };
  }

  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    if (!me.ok) return { ok: false, detail: `Telegram не принял токен бота (${me.status})` };

    const { createServiceClient } = await import("@/lib/supabase/service");
    const { error } = await createServiceClient()
      .from("telegram_link_codes")
      .select("code", { count: "exact", head: true });
    if (error) {
      return {
        ok: false,
        detail: `База не пускает бота: ${error.message}. Проверьте SUPABASE_SERVICE_ROLE_KEY и миграцию 009.`,
      };
    }
    return {
      ok: true,
      detail: kind === "secret" ? "Бот и сервисный ключ в порядке" : "Бот отвечает, тип ключа не распознан",
    };
  } catch (e) {
    return { ok: false, detail: `Ошибка проверки бота: ${String(e)}` };
  }
}

export async function GET() {
  const [tmdb, supabase, telegram] = await Promise.all([
    checkTmdb(),
    checkSupabase(),
    checkTelegramBot(),
  ]);
  return NextResponse.json(
    { tmdb, supabase, telegram },
    { status: tmdb.ok && supabase.ok ? 200 : 503 },
  );
}
