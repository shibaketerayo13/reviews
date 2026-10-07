/** Шаблон для ilike: убираем символы, ломающие фильтр PostgREST, экранируем % и _. */
export function toIlikePattern(q: string): string {
  const cleaned = q.replace(/[,()*"\\]/g, " ").replace(/[%_]/g, (m) => `\\${m}`);
  return `%${cleaned.trim()}%`;
}
