// Блок «Telegram-бот» в профиле: привязать или отвязать.
import { createClient } from "@/lib/supabase/server";
import { botUsername } from "@/lib/telegram/api";
import { startTelegramLink, unlinkTelegram } from "@/app/profile/actions";

export async function TelegramLink({ userId }: { userId: string }) {
  const bot = botUsername();
  if (!bot) return null;

  const supabase = await createClient();
  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_username")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <div className="tg-link">
      <svg className="tg-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.5 4.3 2.9 11.5c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.2-15.4c.2-.9-.7-1.6-1.7-1.5Z" />
        <path d="m7.7 14.8 9.6-6.3" />
      </svg>
      {link ? (
        <>
          <span>
            Telegram привязан
            {link.telegram_username ? (
              <span className="muted"> · @{link.telegram_username}</span>
            ) : null}
            {" · "}
            <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">
              открыть бота
            </a>
          </span>
          <form action={unlinkTelegram}>
            <button type="submit" className="link-button">
              Отвязать
            </button>
          </form>
        </>
      ) : (
        <form action={startTelegramLink}>
          <button type="submit" className="link-button tg-connect">
            Привязать Telegram — оценки и новые фильмы прямо из бота
          </button>
        </form>
      )}
    </div>
  );
}
