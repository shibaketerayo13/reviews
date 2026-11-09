import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

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

export async function Pagination({
  current,
  last,
  href,
}: {
  current: number;
  last: number;
  href: (page: number) => string;
}) {
  if (last <= 1) return null;
  const { t } = await getI18n();
  return (
    <nav className="pagination" aria-label={t.common.pages}>
      {current > 1 ? (
        <Link href={href(current - 1)} className="page-step" rel="prev">
          {t.common.back}
        </Link>
      ) : (
        <span className="page-step is-disabled">{t.common.back}</span>
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
          {t.common.next}
        </Link>
      ) : (
        <span className="page-step is-disabled">{t.common.next}</span>
      )}
    </nav>
  );
}
