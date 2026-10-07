"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth";
import { catalogIdMap } from "@/lib/catalog";
import { chunk, mapLimited } from "@/lib/async";
import { getDetails, isMediaType, searchMovieTv, toTitleRow } from "@/lib/tmdb";
import {
  MAX_LINES,
  type Candidate,
  type ImportItem,
  type ImportResult,
  type ParsedLine,
  type PreviewRow,
} from "@/lib/import";

function isImportStatus(v: unknown): v is "watched" | "planned" | "dropped" {
  return v === "watched" || v === "planned" || v === "dropped";
}

/** До 4 вариантов из TMDB: сначала с тем же годом, потом с соседним. */
async function findCandidates(title: string, year: number | null): Promise<Candidate[]> {
  const found = await searchMovieTv(title).catch(() => []);
  const list: (Candidate & { rank: number })[] = found.map((m, i) => {
    const y = (m.release_date || m.first_air_date || "").slice(0, 4);
    const diff = year && y ? Math.abs(Number(y) - year) : 5;
    return {
      tmdb_id: m.id,
      media_type: m.media_type,
      title: m.title ?? m.name ?? "Без названия",
      original: m.original_title ?? m.original_name ?? null,
      year: y,
      poster_path: m.poster_path,
      // Год важнее позиции в выдаче TMDB
      rank: (diff === 0 ? 0 : diff === 1 ? 1 : 3) * 100 + i,
    };
  });
  return list
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 4)
    .map(({ rank: _rank, ...c }) => c);
}

/** Шаг 1: для каждой строки найти варианты в TMDB. Клиент шлёт строки пачками. */
export async function previewImport(lines: ParsedLine[]): Promise<PreviewRow[]> {
  if (!(await getUser())) return [];
  const safe = lines.slice(0, 60).map((l) => ({
    raw: String(l.raw).slice(0, 300),
    title: String(l.title).slice(0, 200),
    year: Number.isInteger(l.year) ? l.year : null,
    score: Number.isInteger(l.score) && l.score! >= 1 && l.score! <= 10 ? l.score : null,
    status: isImportStatus(l.status) ? l.status : ("watched" as const),
  }));
  return mapLimited(safe, 6, async (l) => ({
    ...l,
    candidates: await findCandidates(l.title, l.year),
  }));
}

/** Повторный поиск одной строки с исправленным названием. */
export async function searchAgain(title: string, year: number | null): Promise<Candidate[]> {
  if (!(await getUser())) return [];
  const q = String(title).trim().slice(0, 200);
  if (!q) return [];
  return findCandidates(q, Number.isInteger(year) ? year : null);
}

/**
 * Шаг 2: сохранить выбранное.
 * Чего нет в каталоге — добавляем (только админ), затем ставим статус и оценку.
 * Комментарии к уже существующим записям не трогаем.
 */
export async function commitImport(items: ImportItem[]): Promise<ImportResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Нужно войти" };
  const profile = await getProfile();

  // Проверяем и убираем повторы
  const clean = new Map<string, ImportItem>();
  for (const it of items.slice(0, MAX_LINES)) {
    const id = Number(it.tmdb_id);
    if (!Number.isInteger(id) || id <= 0 || !isMediaType(it.media_type)) continue;
    const score =
      Number.isInteger(it.score) && it.score! >= 1 && it.score! <= 10 ? it.score : null;
    const status = isImportStatus(it.status) ? it.status : "watched";
    clean.set(`${it.media_type}:${id}`, { tmdb_id: id, media_type: it.media_type, score, status });
  }
  const list = [...clean.values()];
  if (list.length === 0) return { ok: false, error: "Нечего импортировать" };

  const asRefs = list.map((i) => ({ id: i.tmdb_id, media_type: i.media_type }));
  const lookup = async () => {
    const map = new Map<string, number>();
    for (const part of chunk(asRefs, 300)) {
      for (const [k, v] of await catalogIdMap(part)) map.set(k, v);
    }
    return map;
  };

  const supabase = await createClient();
  let ids = await lookup();
  let addedToCatalog = 0;

  const missing = list.filter((i) => !ids.has(`${i.media_type}:${i.tmdb_id}`));
  if (missing.length && profile?.is_admin) {
    const rows = (
      await mapLimited(missing, 6, (i) =>
        getDetails(i.media_type, i.tmdb_id)
          .then((m) => toTitleRow(i.media_type, m))
          .catch(() => null),
      )
    ).filter((r): r is ReturnType<typeof toTitleRow> => r !== null);

    for (const part of chunk(rows, 200)) {
      const { data, error } = await supabase
        .from("titles")
        .upsert(part, { onConflict: "media_type,tmdb_id", ignoreDuplicates: true })
        .select("id");
      if (error) return { ok: false, error: `Ошибка каталога: ${error.message}` };
      addedToCatalog += data?.length ?? 0;
    }
    ids = await lookup();
  }

  const now = new Date().toISOString();
  const ratingRows = new Map<number, Record<string, unknown>>();
  for (const i of list) {
    const titleId = ids.get(`${i.media_type}:${i.tmdb_id}`);
    if (!titleId) continue;
    ratingRows.set(titleId, {
      user_id: user.id,
      title_id: titleId,
      status: i.status,
      score: i.score,
      updated_at: now,
    });
  }

  let imported = 0;
  for (const part of chunk([...ratingRows.values()], 200)) {
    const { error } = await supabase
      .from("ratings")
      .upsert(part, { onConflict: "user_id,title_id" });
    if (error) return { ok: false, error: `Ошибка сохранения оценок: ${error.message}` };
    imported += part.length;
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true, imported, addedToCatalog, skipped: list.length - imported };
}
