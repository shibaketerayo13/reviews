// Импорт оценок: разбор текста. Общий для клиента и сервера (без серверных зависимостей).

export type ImportStatus = "watched" | "planned" | "dropped";

export type ParsedLine = {
  raw: string;
  title: string;
  year: number | null;
  score: number | null;
  status: ImportStatus;
};

/** Заголовок раздела «## Посмотреть позже» меняет статус для строк ниже. */
function sectionStatus(line: string): ImportStatus | null {
  const s = line.replace(/^#+/, "").trim().toLowerCase();
  if (/позже|буду|хочу|planned|plan|watchlist|want/.test(s)) return "planned";
  if (/брош|dropped|abandon/.test(s)) return "dropped";
  if (/просмотр|смотрел|watched|seen/.test(s)) return "watched";
  return null;
}

export type Candidate = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original: string | null;
  year: string;
  poster_path: string | null;
};

export type PreviewRow = ParsedLine & { candidates: Candidate[] };

export type ImportItem = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number | null;
  status: ImportStatus;
};

export const STATUS_TEXT: Record<ImportStatus, string> = {
  watched: "Просмотрено",
  planned: "Посмотреть позже",
  dropped: "Брошено",
};

export type ImportResult =
  | { ok: true; imported: number; addedToCatalog: number; skipped: number }
  | { ok: false; error: string };

export const MAX_LINES = 600;

// Оценка в конце строки после разделителя: «— 8», «- 8», «: 8», «| 8», «\t8» или «8/10»
const SCORE_SEP = /\s*(?:[—–\-:|\t]|\s{2,})\s*(\d{1,2}(?:[.,]\d)?)\s*(?:\/\s*10)?\s*$/;
const SCORE_OF_TEN = /\s+(\d{1,2}(?:[.,]\d)?)\s*\/\s*10\s*$/;
// Год: «(2010)» где угодно или «, 2010» / « 2010» в конце
const YEAR_PAREN = /\((\d{4})\)/;
const YEAR_TAIL = /[,\s]\s*((?:18|19|20)\d{2})\s*$/;

/**
 * Строки вида:
 *   Начало (2010) — 9
 *   Интерстеллар, 2014 - 10
 *   Во все тяжкие (2008) 9/10
 *   Остров проклятых (2010)        ← без оценки
 *   ## Посмотреть позже            ← строки ниже получат этот статус
 */
export function parseLines(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  let status: ImportStatus = "watched";
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw) continue;
    if (raw.startsWith("#")) {
      // «## Раздел» переключает статус, остальные «#…» — комментарии
      if (raw.startsWith("##")) status = sectionStatus(raw) ?? status;
      continue;
    }

    let s = raw.replace(/^\s*\d+[.)]\s+/, ""); // нумерация «12. »
    let score: number | null = null;
    const m = s.match(SCORE_OF_TEN) ?? s.match(SCORE_SEP);
    if (m) {
      const value = Math.round(Number(m[1].replace(",", ".")));
      if (value >= 1 && value <= 10) {
        score = value;
        s = s.slice(0, m.index).trim();
      }
    }

    let year: number | null = null;
    const yp = s.match(YEAR_PAREN);
    if (yp) {
      year = Number(yp[1]);
      s = s.replace(YEAR_PAREN, " ");
    } else {
      const yt = s.match(YEAR_TAIL);
      // Не отрезаем «год», если без него от названия ничего не останется («1917»)
      // и не принимаем за год число из будущего («Бегущий по лезвию 2049»)
      const maxYear = new Date().getFullYear() + 2;
      if (yt && Number(yt[1]) <= maxYear && s.slice(0, yt.index).trim().length > 0) {
        year = Number(yt[1]);
        s = s.slice(0, yt.index);
      }
    }

    const title = s.replace(/\s{2,}/g, " ").replace(/[\s,;—–\-]+$/, "").trim();
    if (title) out.push({ raw, title, year, score, status });
    if (out.length >= MAX_LINES) break;
  }
  return out;
}
