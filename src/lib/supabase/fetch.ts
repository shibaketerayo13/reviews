// fetch с ограничением по времени для запросов к Supabase.
// Если база недоступна (например, проект на паузе), сайт не должен висеть до таймаута Vercel.
export function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

/** Promise с пределом по времени: по истечении или при ошибке возвращает fallback. */
export function withTimeout<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<F>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
