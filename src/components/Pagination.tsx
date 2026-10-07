import Link from "next/link";

/** Номера страниц с многоточиями: 1 … 4 5 [6] 7 8 … 20 */
function pages(current: number, last: number): (number | "gap")[] {
  const out: (number | "gap")[] = [];
  const from = Math.max(2, current - 2);
  const to = Math.min(last - 1, current + 2);
  out.push(1);
  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < last - 1) out.push("gap");
  if (last > 1) out.push(last);
  return out;
}

export function Pagination({
  current,
  last,
  href,
}: {
  current: number;
  last: number;
  href: (page: number) => string;
}) {
  if (last <= 1) return null;
  return (
    <nav className="pagination" aria-label="Страницы">
      {current > 1 ? (
        <Link href={href(current - 1)} className="page-step" rel="prev">
          ← Назад
        </Link>
      ) : (
        <span className="page-step is-disabled">← Назад</span>
      )}

      <div className="page-numbers">
        {pages(current, last).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="page-gap">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              className={`page-num${p === current ? " is-current" : ""}`}
              aria-current={p === current ? "page" : undefined}
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {current < last ? (
        <Link href={href(current + 1)} className="page-step" rel="next">
          Дальше →
        </Link>
      ) : (
        <span className="page-step is-disabled">Дальше →</span>
      )}
    </nav>
  );
}
