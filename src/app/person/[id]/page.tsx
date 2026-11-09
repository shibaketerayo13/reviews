import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogIdMap, titleHref } from "@/lib/catalog";
import { getPerson, posterUrl, type PersonCredit } from "@/lib/tmdb";
import { TmdbCard } from "@/components/TmdbCard";
import { getI18n } from "@/lib/i18n/server";
import { TMDB_LANGUAGE, fmt, formatDate } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n";

/** Подпись основной профессии с учётом пола (актёр / актриса). */
function departmentLabel(t: Dict, dept: string, female: boolean): string {
  const d = t.person.departments;
  if (dept === "Acting") return female ? d.ActingFemale : d.Acting;
  return dept in d ? d[dept as keyof typeof d] : dept;
}

function ageAt(birthday: string, end: string | null): number {
  const b = new Date(birthday);
  const e = end ? new Date(end) : new Date();
  let age = e.getFullYear() - b.getFullYear();
  const m = e.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && e.getDate() < b.getDate())) age--;
  return age;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const person = await getPerson(Number(id), TMDB_LANGUAGE[locale], t.person).catch(() => null);
  return { title: person ? `${person.name} · reviews` : "reviews" };
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ only?: string }>;
}) {
  const { id: rawId } = await params;
  const { only } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { locale, t } = await getI18n();
  const person = await getPerson(id, TMDB_LANGUAGE[locale], t.person).catch(() => null);
  if (!person) notFound();

  const ids = await catalogIdMap(person.credits);
  const inCatalog = (c: PersonCredit) => ids.has(`${c.media_type}:${c.id}`);

  // «Известен по»: самые заметные работы с постерами
  const known = person.credits
    .filter((c) => c.poster_path)
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 12);

  // Фильмография по годам, новые сверху; фильтр «только в каталоге»
  const onlyCatalog = only === "catalog";
  const filmography = person.credits
    .filter((c) => (onlyCatalog ? inCatalog(c) : true))
    .sort((a, b) => (b.year || "0000").localeCompare(a.year || "0000"));
  const catalogCount = person.credits.filter(inCatalog).length;

  const photo = posterUrl(person.profile_path, "h632");
  const born = formatDate(locale, person.birthday);
  const died = formatDate(locale, person.deathday);
  const age = person.birthday ? ageAt(person.birthday, person.deathday) : null;
  const longBio = person.biography.length > 700;

  return (
    <div className="person-page">
      <section className="person-hero">
        <div className="person-photo reveal">
          {photo ? (
            <Image src={photo} alt={person.name} fill sizes="(max-width: 640px) 50vw, 260px" priority />
          ) : (
            <div className="no-poster">{person.name}</div>
          )}
        </div>
        <div className="person-info">
          {person.department && (
            <p className="eyebrow reveal" style={{ "--i": 1 } as React.CSSProperties}>
              {departmentLabel(t, person.department, person.female)}
            </p>
          )}
          <h1 className="title-name reveal" style={{ "--i": 2 } as React.CSSProperties}>
            {person.name}
          </h1>

          <dl className="person-facts reveal" style={{ "--i": 3 } as React.CSSProperties}>
            {born && (
              <div>
                <dt>{t.person.born}</dt>
                <dd>
                  {born}
                  {age !== null && !died && <span className="muted"> · {age}</span>}
                </dd>
              </div>
            )}
            {died && (
              <div>
                <dt>{t.person.died}</dt>
                <dd>
                  {died}
                  {age !== null && <span className="muted"> · {age}</span>}
                </dd>
              </div>
            )}
            {person.place_of_birth && (
              <div>
                <dt>{t.person.birthplace}</dt>
                <dd>{person.place_of_birth}</dd>
              </div>
            )}
            <div>
              <dt>{t.person.works}</dt>
              <dd>
                {person.credits.length}
                {catalogCount > 0 && (
                  <span className="muted"> · {fmt(t.person.inCatalogCount, { n: catalogCount })}</span>
                )}
              </dd>
            </div>
          </dl>

          {person.biography &&
            (longBio ? (
              <details className="bio reveal" style={{ "--i": 4 } as React.CSSProperties}>
                <summary data-collapse={t.person.collapse}>
                  <span className="bio-preview">{person.biography}</span>
                  <span className="bio-more">{t.person.readMore}</span>
                </summary>
                <p className="bio-full">{person.biography}</p>
              </details>
            ) : (
              <p className="bio-text reveal" style={{ "--i": 4 } as React.CSSProperties}>
                {person.biography}
              </p>
            ))}
        </div>
      </section>

      {known.length > 0 && (
        <section>
          <div className="section-head">
            <h2>{t.person.knownFor}</h2>
          </div>
          <div className="rail">
            {known.map((c, i) => (
              <TmdbCard
                key={`${c.media_type}:${c.id}`}
                item={c}
                href={titleHref(c, ids)}
                inCatalog={inCatalog(c)}
                subtitle={c.role || t.media[c.media_type]}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>{t.person.filmography}</h2>
          <span className="section-count">{filmography.length}</span>
          {catalogCount > 0 && (
            <div className="section-toggle">
              <Link
                href={`/person/${id}`}
                className={!onlyCatalog ? "is-active" : ""}
                scroll={false}
              >
                {t.person.all}
              </Link>
              <Link
                href={`/person/${id}?only=catalog`}
                className={onlyCatalog ? "is-active" : ""}
                scroll={false}
              >
                {t.person.inCatalog}
              </Link>
            </div>
          )}
        </div>

        <ol className="filmography">
          {filmography.map((c) => {
            const name = c.title ?? c.name ?? t.common.untitled;
            const local = inCatalog(c);
            return (
              <li key={`${c.media_type}:${c.id}`} className={local ? "is-local" : ""}>
                <span className="film-year">{c.year || "—"}</span>
                <Link href={titleHref(c, ids)} className="film-title">
                  {name}
                </Link>
                <span className="film-role">
                  {c.role && <span>{c.role}</span>}
                  <span className="film-type">{t.media[c.media_type]}</span>
                </span>
                {local && <span className="film-dot" title={t.person.hasInCatalog} />}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
