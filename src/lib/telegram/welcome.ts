// Приветствие бота: промо-ролик с коротким описанием сайта и бота.
// Ролик лежит на сайте (public/promo.mp4), Telegram скачивает его по ссылке.
// После первой отправки Telegram выдаёт file_id — дальше шлём по нему, без повторной загрузки.
import { esc, tg, type InlineKeyboard } from "./api";

type Ctx = { siteUrl: string };

/** file_id ролика на серверах Telegram (живёт, пока жив экземпляр функции). */
let promoFileId: string | null = process.env.TELEGRAM_PROMO_FILE_ID || null;

function caption(linkedName: string | null): string {
  const lines = [
    "<b>reviews.</b> — дневник фильмов и сериалов",
    "",
    "<b>На сайте</b> — каталог с поиском, оценки от 1 до 10, списки «Просмотрено», " +
      "«Посмотреть позже» и «Брошено», любимые фильмы. Профилем можно поделиться ссылкой.",
    "",
    "<b>В этом боте</b> — пришлите название фильма, лучше с годом: <i>Интерстеллар 2014</i>. " +
      "Я найду его на сайте или добавлю из TMDB и предложу поставить оценку — она сразу появится в вашем профиле.",
    "",
  ];
  if (linkedName !== null) {
    lines.push(
      linkedName
        ? `Аккаунт <b>${esc(linkedName)}</b> привязан — присылайте название фильма.`
        : "Аккаунт привязан — присылайте название фильма.",
    );
  } else {
    lines.push("Чтобы начать, привяжите аккаунт: откройте профиль на сайте и нажмите «Привязать Telegram».");
  }
  return lines.join("\n");
}

function keyboard(ctx: Ctx, linked: boolean): InlineKeyboard {
  return [
    linked
      ? [
          { text: "Открыть сайт", url: ctx.siteUrl },
          { text: "Мой профиль", url: `${ctx.siteUrl}/profile` },
        ]
      : [
          { text: "Открыть сайт", url: ctx.siteUrl },
          { text: "Привязать аккаунт", url: `${ctx.siteUrl}/profile` },
        ],
  ];
}

/**
 * Отправляет промо-ролик с описанием.
 * linkedName: null — аккаунт не привязан; строка (можно пустую) — привязан.
 */
export async function sendPromo(chatId: number, ctx: Ctx, linkedName: string | null) {
  const text = caption(linkedName);
  const reply_markup = { inline_keyboard: keyboard(ctx, linkedName !== null) };

  const base = {
    chat_id: chatId,
    caption: text,
    parse_mode: "HTML",
    reply_markup,
    width: 1920,
    height: 1080,
    duration: 30,
    supports_streaming: true,
  };

  const byUrl = () =>
    tg<{ video?: { file_id: string } }>("sendVideo", {
      ...base,
      video: `${ctx.siteUrl}/promo.mp4`,
      cover: `${ctx.siteUrl}/promo-cover.jpg`,
    });

  try {
    let sent: { video?: { file_id: string } };
    if (promoFileId) {
      try {
        sent = await tg("sendVideo", { ...base, video: promoFileId });
      } catch {
        // file_id устарел — загружаем заново по ссылке
        promoFileId = null;
        sent = await byUrl();
      }
    } else {
      sent = await byUrl();
    }
    if (sent.video?.file_id && !promoFileId) {
      promoFileId = sent.video.file_id;
      console.log("[telegram] promo file_id:", promoFileId);
    }
  } catch (e) {
    // Не удалось отправить видео (например, сайт ещё не выложен) — шлём описание текстом
    console.error("[telegram] промо-ролик:", e instanceof Error ? e.message : e);
    await tg("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup,
      link_preview_options: { is_disabled: true },
    });
  }
}
