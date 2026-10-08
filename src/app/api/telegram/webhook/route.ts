// Вебхук Telegram-бота. Telegram присылает сюда сообщения и нажатия кнопок.
import { NextResponse, type NextRequest } from "next/server";
import { webhookSecret, type TgUpdate } from "@/lib/telegram/api";
import { handleUpdate } from "@/lib/telegram/bot";
import { siteUrl } from "@/lib/telegram/site";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const secret = webhookSecret();
  // Чужие запросы (без секретного заголовка от Telegram) отклоняем
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TgUpdate | null;
  if (update) {
    try {
      await handleUpdate(update, { siteUrl: siteUrl(request.nextUrl.origin) });
    } catch (e) {
      // Отвечаем 200 в любом случае, иначе Telegram будет повторять одно и то же сообщение
      console.error("[telegram webhook]", e);
    }
  }
  return NextResponse.json({ ok: true });
}
