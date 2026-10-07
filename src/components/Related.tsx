import { catalogIdMap, titleHref } from "@/lib/catalog";
import type { TmdbSearchItem } from "@/lib/tmdb";
import { TmdbCard } from "./TmdbCard";

/** «Похожие»: сначала то, что уже есть в каталоге сайта. */
export async function Related({ items }: { items: TmdbSearchItem[] }) {
  if (items.length === 0) return null;
  const ids = await catalogIdMap(items);
  const sorted = [...items].sort(
    (a, b) =>
      Number(ids.has(`${b.media_type}:${b.id}`)) - Number(ids.has(`${a.media_type}:${a.id}`)),
  );

  return (
    <section className="related">
      <div className="section-head">
        <h2>Похожие</h2>
      </div>
      <div className="rail">
        {sorted.map((item, i) => (
          <TmdbCard
            key={`${item.media_type}:${item.id}`}
            item={item}
            href={titleHref(item, ids)}
            inCatalog={ids.has(`${item.media_type}:${item.id}`)}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
