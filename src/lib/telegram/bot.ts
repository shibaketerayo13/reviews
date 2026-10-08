// Логика Telegram-бота: привязка аккаунта, поиск фильма, докачка из TMDB, оценки.
// Работает через сервисный клиент Supabase, поэтому каждый запрос явно ограничен
// пользователем, к которому привязан этот Telegram.
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { toIlikePattern } from "@/lib/search";
import {
  getDetails,
  posterUrl,
  searchMovieTv,
  toTitleRow,
  type MediaType,
  type TmdbSearchItem,
} from "@/lib/tmdb";
import { MEDIA_LABEL, STATUS_LABEL, yearOf, type Title, type WatchStatus } from "@/lib/types";
import {
  esc,
  tg,
  type InlineKeyboard,
  type TgCallbackQuery,
  type TgMessage,
  type TgUpdate,
  type TgUser,
} from "./api";

/** Сколько новых фильмов один пользователь может добавить в каталог за сутки. */
const DAILY_ADD_LIMIT = 30;
const MAX_CHOICES = 8;

type Ctx = { siteUrl: string };

type Linked = { userId: string; isAdmin: boolean; username: string | null };

type Entry = {
  status: WatchStatus;
  score: number | null;
  is_favorite: boolean;
};

class UserError extends Error {}

/* ---------- Входная точка ---------- */

export async function handleUpdate(update: TgUpdate, ctx: Ctx): Promise<void> {
  if (update.message) await onMessage(update.message, ctx);
  else if (update.callback_query) await onCallback(update.callback_query, ctx);
}

/* ---------- Сообщения ---------- */

async function onMessage(msg: TgMessage, ctx: Ctx) {
  // Только личные чаты: в группах бот молчит
  if (msg.chat.type !== "private" || !msg.from) return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();

  if (!text) {
    await send(chatId, "Пришлите название текстом, например: <i>Интерстеллар 2014</i>");
    return;
  }

  const start = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (start) {
    if (start[1]) await linkAccount(chatId, msg.from, start[1]);
    else await sendWelcome(chatId, msg.from, ctx);
    return;
  }
  if (/^\/help\b/.test(text)) {
    await sendHelp(chatId);
    return;
  }
  if (/^\/unlink\b/.test(text)) {
    await unlink(chatId, msg.from);
    return;
  }
  if (text.startsWith("/")) {
    await send(chatId, "Не знаю такой команды. Список команд: /help");
    return;
  }

  const user = await linkedUser(msg.from.id);
  if (!user) {
    await sendNeedLink(chatId, ctx);
    return;
  }
  await search(chatId, user, text, ctx);
}

async function sendWelcome(chatId: number, from: TgUser, ctx: Ctx) {
  const user = await linkedUser(from.id);
  if (!user) {
    await sendNeedLink(chatId, ctx);
    return;
  }
  await send(
    chatId,
    "Пришлите название фильма или сериала, можно с годом: <i>Интерстеллар 2014</i>.\n\n" +
      "Если он уже есть на сайте, я покажу его и предложу поставить оценку. " +
      "Если нет — найду в TMDB и добавлю.",
  );
}

async function sendHelp(chatId: number) {
  await send(
    chatId,
    [
      "<b>Как пользоваться</b>",
      "Пришлите название фильма или сериала, лучше с годом: <i>Форсаж 2001</i>, <i>Тьма 2017</i>.",
      "",
      "• Фильм есть на сайте — пришлю карточку с кнопками оценки 1–10, «Позже», «Брошено» и ♥.",
      "• Фильма нет — найду в TMDB и добавлю на сайт. Если вариантов несколько, предложу выбрать.",
      "• Нашёлся не тот фильм — допишите год.",
      "",
      "/unlink — отвязать Telegram от аккаунта",
    ].join("\n"),
  );
}

async function sendNeedLink(chatId: number, ctx: Ctx) {
  await send(
    chatId,
    "Сначала привяжите аккаунт <b>reviews</b>: откройте свой профиль на сайте и нажмите " +
      "«Привязать Telegram». Пароль сюда вводить не нужно.",
    [[{ text: "Открыть профиль", url: `${ctx.siteUrl}/profile` }]],
  );
}

/* ---------- Привязка аккаунта ---------- */

async function linkAccount(chatId: number, from: TgUser, code: string) {
  const db = createServiceClient();
  if (!/^[a-f0-9]{48}$/.test(code)) {
    await send(chatId, "Ссылка для привязки неверная. Нажмите «Привязать Telegram» в профиле ещё раз.");
    return;
  }

  const { data: row } = await db
    .from("telegram_link_codes")
    .select("user_id, expires_at")
    .eq("code", code)
    .maybeSingle();
  // Код одноразовый: удаляем сразу
  await db.from("telegram_link_codes").delete().eq("code", code);

  if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
    await send(
      chatId,
      "Ссылка для привязки устарела (она действует 15 минут). Нажмите «Привязать Telegram» в профиле ещё раз.",
    );
    return;
  }
  const userId = row.user_id as string;

  // Перепривязка: этот Telegram или этот аккаунт могли быть привязаны раньше
  await db.from("telegram_links").delete().eq("telegram_id", from.id);
  await db.from("telegram_links").delete().eq("user_id", userId);
  const { error } = await db.from("telegram_links").insert({
    user_id: userId,
    telegram_id: from.id,
    telegram_username: from.username ?? null,
  });
  if (error) {
    await send(chatId, "Не получилось привязать аккаунт. Попробуйте ещё раз чуть позже.");
    return;
  }

  const { data: profile } = await db
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();
  const name = (profile?.display_name as string | null) ?? (profile?.username as string | null) ?? "";
  revalidatePath("/profile");

  await send(
    chatId,
    `Готово! Telegram привязан к аккаунту <b>${esc(name)}</b>.\n\n` +
      "Теперь пришлите название фильма или сериала, например: <i>Интерстеллар 2014</i>.",
  );
}

async function unlink(chatId: number, from: TgUser) {
  const db = createServiceClient();
  const { data } = await db
    .from("telegram_links")
    .delete()
    .eq("telegram_id", from.id)
    .select("user_id");
  revalidatePath("/profile");
  await send(
    chatId,
    data?.length
      ? "Telegram отвязан от аккаунта. Привязать снова можно в профиле на сайте."
      : "Этот Telegram и так не привязан ни к одному аккаунту.",
  );
}

async function linkedUser(telegramId: number): Promise<Linked | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("telegram_links")
    .select("user_id, profiles(is_admin, username)")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (!data) return null;
  const profile = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as
    | { is_admin: boolean; username: string | null }
    | null;
  return {
    userId: data.user_id as string,
    isAdmin: Boolean(profile?.is_admin),
    username: profile?.username ?? null,
  };
}

/* ---------- Поиск ---------- */

/** «Интерстеллар 2014», «Тьма (2017)» → название и год. «1917» и «Бегущий по лезвию 2049» — без года. */
export function parseQuery(text: string): { title: string; year: number | null } {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 100);
  const m = clean.match(/^(.*?)[\s,]*\(?((?:18|19|20)\d{2})\)?\.?$/);
  const maxYear = new Date().getFullYear() + 3;
  if (m && m[1].trim()) {
    const year = Number(m[2]);
    if (year >= 1880 && year <= maxYear) return { title: m[1].trim(), year };
  }
  return { title: clean, year: null };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const tmdbYear = (i: TmdbSearchItem) =>
  Number((i.release_date || i.first_air_date || "").slice(0, 4)) || null;

async function search(chatId: number, user: Linked, text: string, ctx: Ctx) {
  const { title, year } = parseQuery(text);
  if (title.length < 2) {
    await send(chatId, "Слишком коротко. Пришлите название целиком, например: <i>Интерстеллар 2014</i>");
    return;
  }
  const db = createServiceClient();

  // 1. Каталог сайта
  const pattern = toIlikePattern(title);
  let q = db
    .from("titles")
    .select("*")
    .or(`title.ilike.${pattern},original_title.ilike.${pattern}`);
  if (year) q = q.gte("release_date", `${year}-01-01`).lte("release_date", `${year}-12-31`);
  const { data: localData } = await q
    .order("tmdb_rating", { ascending: false, nullsFirst: false })
    .limit(MAX_CHOICES);
  const local = (localData ?? []) as Title[];

  const wanted = norm(title);
  const isExact = (t: Title) =>
    norm(t.title) === wanted || (t.original_title !== null && norm(t.original_title) === wanted);
  const exact = local.filter(isExact);
  if (exact.length === 1 || (year && local.length === 1)) {
    await sendTitleCard(chatId, user, exact[0] ?? local[0], ctx);
    return;
  }

  // 2. TMDB: то, чего на сайте нет (и то, что есть, но под другим названием)
  let found: TmdbSearchItem[] = [];
  let tmdbFailed = false;
  try {
    found = await searchMovieTv(title);
  } catch {
    tmdbFailed = true;
  }
  if (year) found = found.filter((i) => tmdbYear(i) === year);

  const inCatalog = new Map<string, Title>();
  if (found.length) {
    const { data } = await db
      .from("titles")
      .select("*")
      .in(
        "tmdb_id",
        found.map((i) => i.id),
      );
    for (const t of (data ?? []) as Title[]) inCatalog.set(`${t.media_type}:${t.tmdb_id}`, t);
  }

  const localAll = [...local];
  for (const t of inCatalog.values()) {
    if (!localAll.some((l) => l.id === t.id)) localAll.push(t);
  }
  localAll.sort((a, b) => Number(isExact(b)) - Number(isExact(a)));
  const missing = found.filter((i) => !inCatalog.has(`${i.media_type}:${i.id}`));

  if (localAll.length === 0 && missing.length === 0) {
    await send(
      chatId,
      `Ничего не нашёл по запросу «${esc(title)}»${year ? ` (${year})` : ""}.` +
        (tmdbFailed
          ? "\nПоиск в TMDB сейчас недоступен, попробуйте позже."
          : year
            ? "\nПопробуйте без года или с другим годом."
            : "\nПроверьте написание или попробуйте оригинальное название."),
    );
    return;
  }

  // Однозначный результат: сразу карточка (новый фильм при этом добавляется на сайт)
  if (localAll.length === 1 && missing.length === 0) {
    await sendTitleCard(chatId, user, localAll[0], ctx);
    return;
  }
  if (localAll.length === 0 && missing.length === 1) {
    try {
      const added = await addFromTmdb(user, missing[0].media_type, missing[0].id);
      await sendTitleCard(chatId, user, added, ctx, "Этого фильма не было на сайте — добавил.");
    } catch (e) {
      await send(chatId, errorText(e));
    }
    return;
  }

  // Несколько вариантов: выбор кнопками. «＋» — ещё нет на сайте
  const rows: InlineKeyboard = [];
  for (const t of localAll.slice(0, MAX_CHOICES)) {
    rows.push([{ text: choiceLabel(t.title, yearOf(t.release_date), t.media_type), callback_data: `t:${t.id}` }]);
  }
  for (const i of missing.slice(0, Math.max(0, MAX_CHOICES - rows.length))) {
    const name = i.title ?? i.name ?? "Без названия";
    rows.push([
      {
        text: "＋ " + choiceLabel(name, String(tmdbYear(i) ?? ""), i.media_type),
        callback_data: `a:${i.media_type === "movie" ? "m" : "t"}:${i.id}`,
      },
    ]);
  }
  await send(
    chatId,
    `Нашёл несколько вариантов по запросу «${esc(title)}»${year ? ` (${year})` : ""}. Выберите нужный.` +
      (missing.length ? "\n«＋» — этого ещё нет на сайте, добавлю." : ""),
    rows,
  );
}

function choiceLabel(name: string, year: string, type: MediaType) {
  const label = `${name}${year ? ` (${year})` : ""} · ${MEDIA_LABEL[type]}`;
  return label.length > 60 ? label.slice(0, 59) + "…" : label;
}

/* ---------- Докачка из TMDB ---------- */

async function addFromTmdb(user: Linked, type: MediaType, tmdbId: number): Promise<Title> {
  const db = createServiceClient();
  const existing = await db
    .from("titles")
    .select("*")
    .eq("media_type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (existing.data) return existing.data as Title;

  if (!user.isAdmin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("titles")
      .select("id", { count: "exact", head: true })
      .eq("added_by", user.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_ADD_LIMIT) {
      throw new UserError(
        `За сутки можно добавить на сайт не больше ${DAILY_ADD_LIMIT} новых фильмов. Попробуйте завтра.`,
      );
    }
  }

  const media = await getDetails(type, tmdbId).catch(() => null);
  if (!media) throw new UserError("Не удалось получить данные из TMDB. Попробуйте чуть позже.");
  if ((media as { adult?: boolean }).adult) throw new UserError("Этот фильм нельзя добавить.");

  const row = { ...toTitleRow(type, media), added_by: user.userId };
  const { data, error } = await db
    .from("titles")
    .upsert(row, { onConflict: "media_type,tmdb_id", ignoreDuplicates: true })
    .select("*");
  if (error) throw new UserError("Не удалось сохранить фильм на сайте.");

  let title = (data?.[0] ?? null) as Title | null;
  if (!title) {
    // Кто-то добавил этот фильм одновременно с нами
    const again = await db
      .from("titles")
      .select("*")
      .eq("media_type", type)
      .eq("tmdb_id", tmdbId)
      .single();
    title = again.data as Title;
  }

  revalidatePath("/");
  revalidatePath("/catalog");
  return title;
}

/* ---------- Карточка фильма ---------- */

async function loadCard(userId: string, titleId: number) {
  const db = createServiceClient();
  const [titleRes, entryRes, statRes] = await Promise.all([
    db.from("titles").select("*").eq("id", titleId).maybeSingle(),
    db
      .from("ratings")
      .select("status, score, is_favorite")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .maybeSingle(),
    db.from("title_stats").select("avg_score, ratings_count").eq("title_id", titleId).maybeSingle(),
  ]);
  if (!titleRes.data) throw new UserError("Этого фильма больше нет на сайте.");
  return {
    title: titleRes.data as Title,
    entry: (entryRes.data ?? null) as Entry | null,
    stat: statRes.data
      ? { avg: Number(statRes.data.avg_score), count: Number(statRes.data.ratings_count) }
      : null,
  };
}

function renderCard(
  card: Awaited<ReturnType<typeof loadCard>>,
  ctx: Ctx,
  note?: string,
): { caption: string; keyboard: InlineKeyboard } {
  const { title: t, entry, stat } = card;
  const year = yearOf(t.release_date);
  const lines: string[] = [];
  if (note) lines.push(`<i>${esc(note)}</i>`, "");
  lines.push(`<b>${esc(t.title)}</b>${year ? ` (${year})` : ""}`);
  if (t.original_title && t.original_title !== t.title) lines.push(`<i>${esc(t.original_title)}</i>`);

  const meta = [MEDIA_LABEL[t.media_type]];
  if (t.tmdb_rating != null) meta.push(`TMDB ${Number(t.tmdb_rating).toFixed(1)}`);
  if (stat) meta.push(`на сайте ${stat.avg.toFixed(1)} (${stat.count} оц.)`);
  lines.push(meta.join(" · "));

  if (t.overview) {
    const overview = t.overview.length > 320 ? t.overview.slice(0, 319).trimEnd() + "…" : t.overview;
    lines.push("", esc(overview));
  }

  lines.push("");
  if (entry) {
    const parts = [`<b>${STATUS_LABEL[entry.status]}</b>`];
    if (entry.score != null) parts.push(`ваша оценка ${entry.score}`);
    if (entry.is_favorite) parts.push("♥ в любимых");
    lines.push("В профиле: " + parts.join(" · "));
  } else {
    lines.push("Ещё нет в вашем профиле. Поставьте оценку или отложите на потом.");
  }

  const scoreButton = (n: number) => ({
    text: entry?.score === n ? `• ${n} •` : String(n),
    callback_data: `r:${t.id}:${n}`,
  });
  const keyboard: InlineKeyboard = [
    [1, 2, 3, 4, 5].map(scoreButton),
    [6, 7, 8, 9, 10].map(scoreButton),
    [
      {
        text: entry?.status === "planned" ? "✓ Позже" : "Посмотреть позже",
        callback_data: `p:${t.id}`,
      },
      { text: entry?.status === "dropped" ? "✓ Брошено" : "Брошено", callback_data: `d:${t.id}` },
      { text: entry?.is_favorite ? "♥" : "♡", callback_data: `f:${t.id}` },
    ],
    [{ text: "Открыть на сайте", url: `${ctx.siteUrl}/title/${t.id}` }],
  ];

  let caption = lines.join("\n");
  if (caption.length > 1024) caption = caption.slice(0, 1020) + "…";
  return { caption, keyboard };
}

async function sendTitleCard(chatId: number, user: Linked, title: Title, ctx: Ctx, note?: string) {
  const card = await loadCard(user.userId, title.id);
  const { caption, keyboard } = renderCard(card, ctx, note);
  const photo = posterUrl(card.title.poster_path, "w500");
  if (photo) {
    try {
      await tg("sendPhoto", {
        chat_id: chatId,
        photo,
        caption,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    } catch {
      /* постер не загрузился: отправим текстом */
    }
  }
  await send(chatId, caption, keyboard);
}

/* ---------- Кнопки ---------- */

async function onCallback(cb: TgCallbackQuery, ctx: Ctx) {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;
  let toast = "";

  try {
    const user = await linkedUser(cb.from.id);
    if (!user || !chatId) {
      await tg("answerCallbackQuery", {
        callback_query_id: cb.id,
        text: "Сначала привяжите аккаунт в профиле на сайте",
        show_alert: true,
      });
      return;
    }

    let m: RegExpMatchArray | null;
    if ((m = data.match(/^t:(\d{1,12})$/))) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
      const card = await loadCard(user.userId, Number(m[1]));
      await sendTitleCard(chatId, user, card.title, ctx);
      return;
    }

    if ((m = data.match(/^a:([mt]):(\d{1,12})$/))) {
      const type: MediaType = m[1] === "m" ? "movie" : "tv";
      const title = await addFromTmdb(user, type, Number(m[2]));
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Добавлено на сайт" });
      await sendTitleCard(chatId, user, title, ctx, "Этого фильма не было на сайте — добавил.");
      return;
    }

    if ((m = data.match(/^([rpdf]):(\d{1,12})(?::(\d{1,2}))?$/))) {
      const titleId = Number(m[2]);
      toast = await applyAction(user, m[1] as "r" | "p" | "d" | "f", titleId, Number(m[3]));
      await refreshCard(cb, user, titleId, ctx);
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: toast });
      return;
    }

    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Кнопка устарела" });
  } catch (e) {
    await tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: errorText(e),
      show_alert: true,
    }).catch(() => {});
  }
}

async function applyAction(
  user: Linked,
  action: "r" | "p" | "d" | "f",
  titleId: number,
  score: number,
): Promise<string> {
  const db = createServiceClient();
  const { data: title } = await db.from("titles").select("id").eq("id", titleId).maybeSingle();
  if (!title) throw new UserError("Этого фильма больше нет на сайте.");

  const { data: existingData } = await db
    .from("ratings")
    .select("status, score, is_favorite")
    .eq("user_id", user.userId)
    .eq("title_id", titleId)
    .maybeSingle();
  const existing = existingData as Entry | null;
  const now = new Date().toISOString();
  const base = { user_id: user.userId, title_id: titleId, updated_at: now };
  let toast: string;

  if (action === "r") {
    if (!Number.isInteger(score) || score < 1 || score > 10) throw new UserError("Оценка от 1 до 10");
    // Оценка переносит «Посмотреть позже» в «Просмотрено»; «Брошено» остаётся брошенным
    const status: WatchStatus = existing?.status === "dropped" ? "dropped" : "watched";
    const { error } = await db
      .from("ratings")
      .upsert({ ...base, status, score }, { onConflict: "user_id,title_id" });
    if (error) throw new UserError("Не удалось сохранить оценку");
    toast =
      `Оценка ${score} сохранена` +
      (existing?.status === "planned" ? " · перенесено в «Просмотрено»" : "");
  } else if (action === "p") {
    if (existing?.score != null) {
      return "У фильма уже есть оценка, поэтому он в «Просмотрено»";
    }
    if (existing?.status === "planned") {
      // Повторное нажатие убирает из «Посмотреть позже»
      if (existing.is_favorite) return "Фильм в любимых, поэтому остаётся в профиле";
      await db.from("ratings").delete().eq("user_id", user.userId).eq("title_id", titleId);
      toast = "Убрано из «Посмотреть позже»";
    } else {
      const { error } = await db
        .from("ratings")
        .upsert({ ...base, status: "planned" }, { onConflict: "user_id,title_id" });
      if (error) throw new UserError("Не удалось сохранить");
      toast = "Добавлено в «Посмотреть позже»";
    }
  } else if (action === "d") {
    if (existing?.status === "dropped") return "Уже в «Брошено»";
    const { error } = await db
      .from("ratings")
      .upsert({ ...base, status: "dropped" }, { onConflict: "user_id,title_id" });
    if (error) throw new UserError("Не удалось сохранить");
    toast = "Перенесено в «Брошено»";
  } else {
    const on = !existing?.is_favorite;
    if (!existing) {
      const { error } = await db.from("ratings").insert({
        ...base,
        status: "watched",
        is_favorite: true,
        favorited_at: now,
      });
      if (error) throw new UserError("Не удалось сохранить");
    } else {
      const { error } = await db
        .from("ratings")
        .update({
          is_favorite: on,
          favorited_at: on ? now : null,
          // Любимый фильм из «Посмотреть позже» считается просмотренным
          ...(on && existing.status === "planned" ? { status: "watched" } : {}),
        })
        .eq("user_id", user.userId)
        .eq("title_id", titleId);
      if (error) throw new UserError("Не удалось сохранить");
    }
    toast = on ? "Добавлено в любимые ♥" : "Убрано из любимых";
  }

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/profile");
  if (user.username) revalidatePath(`/u/${user.username}`);
  return toast;
}

/** Перерисовывает карточку в том же сообщении после нажатия кнопки. */
async function refreshCard(cb: TgCallbackQuery, user: Linked, titleId: number, ctx: Ctx) {
  const msg = cb.message;
  if (!msg) return;
  const card = await loadCard(user.userId, titleId);
  // Пометка «добавил на сайт» в начале подписи сохраняется
  const hadNote = (msg.caption ?? msg.text ?? "").startsWith("Этого фильма не было");
  const { caption, keyboard } = renderCard(
    card,
    ctx,
    hadNote ? "Этого фильма не было на сайте — добавил." : undefined,
  );
  const common = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard },
  };
  try {
    if (msg.photo) await tg("editMessageCaption", { ...common, caption });
    else await tg("editMessageText", { ...common, text: caption, link_preview_options: { is_disabled: true } });
  } catch (e) {
    // «message is not modified» — ничего не поменялось, это нормально
    if (!(e instanceof Error && e.message.includes("not modified"))) throw e;
  }
}

/* ---------- Вспомогательное ---------- */

async function send(chatId: number, text: string, keyboard?: InlineKeyboard) {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

function errorText(e: unknown): string {
  if (e instanceof UserError) return e.message;
  console.error("[telegram]", e);
  return "Что-то пошло не так. Попробуйте ещё раз чуть позже.";
}
