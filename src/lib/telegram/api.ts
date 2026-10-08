// Минимальный клиент Telegram Bot API. Токен берётся из переменной окружения и не покидает сервер.
import { createHash } from "node:crypto";

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };
export type InlineKeyboard = InlineButton[][];

export type TgUser = { id: number; username?: string; first_name?: string };
export type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: unknown[];
};
export type TgCallbackQuery = {
  id: string;
  from: TgUser;
  data?: string;
  message?: TgMessage;
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
}

/**
 * Секрет вебхука выводится из токена бота, чтобы не заводить ещё одну переменную.
 * Telegram присылает его в заголовке X-Telegram-Bot-Api-Secret-Token.
 */
export function webhookSecret(): string | null {
  const token = botToken();
  if (!token) return null;
  return createHash("sha256").update(`reviews-webhook:${token}`).digest("hex");
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан (см. .env.example)");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string }
    | null;
  if (!json?.ok) {
    throw new Error(`Telegram ${method}: ${json && "description" in json ? json.description : res.status}`);
  }
  return json.result;
}

/** Экранирование для parse_mode: "HTML". */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
