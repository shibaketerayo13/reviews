"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { chunk } from "@/lib/async";
import {
  MAX_LINES,
  STATUS_TEXT,
  parseLines,
  type ImportStatus,
  type Candidate,
  type ImportItem,
  type ImportResult,
  type PreviewRow,
} from "@/lib/import";
import { commitImport, previewImport, searchAgain } from "@/app/profile/import/actions";

const POSTER = "/img/t/w92"; // постеры через прокси сайта (lib/images.ts)
const TYPE = { movie: "Фильм", tv: "Сериал" } as const;
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Row = PreviewRow & {
  choice: number; // индекс варианта, -1 = пропустить
  query: string;
};

const EXAMPLE = `Начало (2010) — 9
Интерстеллар (2014) — 10
Во все тяжкие (2008) — 9
Остров проклятых (2010)`;

export function ImportWizard({ isAdmin }: { isAdmin: boolean }) {
  const [step, setStep] = useState<"paste" | "review" | "done">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseLines(text), [text]);

  async function check() {
    setError(null);
    const batches = chunk(parsed, 25);
    setProgress({ done: 0, total: parsed.length });
    const all: Row[] = [];
    try {
      for (const batch of batches) {
        const res = await previewImport(batch);
        all.push(
          ...res.map((r) => ({ ...r, choice: r.candidates.length ? 0 : -1, query: r.title })),
        );
        setProgress({ done: all.length, total: parsed.length });
      }
      setRows(all);
      setStep("review");
    } catch {
      setError("Не удалось связаться с сервером. Попробуйте ещё раз.");
    } finally {
      setProgress(null);
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function retry(i: number) {
    const r = rows[i];
    update(i, { candidates: [], choice: -1 });
    const candidates = await searchAgain(r.query, r.year);
    update(i, { candidates, choice: candidates.length ? 0 : -1 });
  }

  async function commit() {
    setSaving(true);
    setError(null);
    const items: ImportItem[] = rows
      .filter((r) => r.choice >= 0 && r.candidates[r.choice])
      .map((r) => {
        const c = r.candidates[r.choice];
        return {
          tmdb_id: c.tmdb_id,
          media_type: c.media_type,
          score: r.status === "planned" ? null : r.score,
          status: r.status,
        };
      });
    try {
      const res = await commitImport(items);
      setResult(res);
      if (res.ok) setStep("done");
      else setError(res.error);
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  const selected = rows.filter((r) => r.choice >= 0).length;
  const notFound = rows.filter((r) => r.candidates.length === 0).length;

  if (step === "done" && result?.ok) {
    return (
      <div className="empty import-done reveal">
        <p className="empty-title">Готово</p>
        <p>
          В профиль добавлено: <strong>{result.imported}</strong>
          {result.addedToCatalog > 0 && (
            <>
              {" "}
              · новых в каталоге: <strong>{result.addedToCatalog}</strong>
            </>
          )}
          {result.skipped > 0 && (
            <>
              {" "}
              · пропущено: <strong>{result.skipped}</strong>
            </>
          )}
        </p>
        {result.skipped > 0 && !isAdmin && (
          <p className="muted small-text">
            Пропущенных фильмов нет в каталоге сайта, добавить их может администратор.
          </p>
        )}
        <div className="hero-actions">
          <Link href="/profile" className="button">
            Открыть профиль
          </Link>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setText("");
              setRows([]);
              setResult(null);
              setStep("paste");
            }}
          >
            Импортировать ещё
          </button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <>
        <div className="import-bar">
          <span>
            Строк: <strong>{rows.length}</strong> · к импорту: <strong>{selected}</strong>
            {notFound > 0 && (
              <>
                {" "}
                · не найдено: <strong className="accent">{notFound}</strong>
              </>
            )}
          </span>
          <div className="import-bar-actions">
            <button type="button" className="button button-ghost button-small" onClick={() => setStep("paste")}>
              ← Назад
            </button>
            <button
              type="button"
              className="button button-small"
              disabled={saving || selected === 0}
              onClick={commit}
            >
              {saving ? "Сохраняю…" : `Импортировать ${selected}`}
            </button>
          </div>
        </div>
        {error && <p className="notice error">{error}</p>}

        <ul className="import-list">
          {rows.map((r, i) => {
            const c: Candidate | undefined = r.candidates[r.choice];
            return (
              <li key={i} className={`import-row${r.choice < 0 ? " is-skipped" : ""}`}>
                <div className="import-poster">
                  {c?.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${POSTER}${c.poster_path}`} alt="" width={46} height={69} />
                  ) : (
                    <span />
                  )}
                </div>

                <div className="import-main">
                  <p className="import-raw" title="Исходная строка">
                    {r.raw}
                  </p>
                  {r.candidates.length > 0 ? (
                    <select
                      value={r.choice}
                      onChange={(e) => update(i, { choice: Number(e.target.value) })}
                      aria-label="Совпадение"
                    >
                      {r.candidates.map((cand, k) => (
                        <option key={k} value={k}>
                          {cand.title}
                          {cand.year ? ` (${cand.year})` : ""} · {TYPE[cand.media_type]}
                          {cand.original && cand.original !== cand.title ? ` · ${cand.original}` : ""}
                        </option>
                      ))}
                      <option value={-1}>— пропустить</option>
                    </select>
                  ) : (
                    <form
                      className="import-retry"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void retry(i);
                      }}
                    >
                      <input
                        value={r.query}
                        onChange={(e) => update(i, { query: e.target.value })}
                        aria-label="Название для поиска"
                      />
                      <button type="submit" className="button button-small button-ghost">
                        Искать
                      </button>
                    </form>
                  )}
                </div>

                <select
                  className="import-status"
                  value={r.status}
                  onChange={(e) => update(i, { status: e.target.value as ImportStatus })}
                  aria-label="Статус"
                >
                  {(Object.keys(STATUS_TEXT) as ImportStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_TEXT[s]}
                    </option>
                  ))}
                </select>

                <select
                  className="import-score"
                  disabled={r.status === "planned"}
                  value={r.status === "planned" ? "" : (r.score ?? "")}
                  onChange={(e) =>
                    update(i, { score: e.target.value ? Number(e.target.value) : null })
                  }
                  aria-label="Оценка"
                >
                  <option value="">—</option>
                  {SCORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <div className="import-paste">
      <label className="field">
        <span>
          По одному фильму или сериалу в строке: название, год в скобках и оценка после
          тире. Год и оценку можно не указывать. Строка «## Посмотреть позже» или
          «## Брошено» меняет статус для всех строк ниже.
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={EXAMPLE}
          spellCheck={false}
        />
      </label>
      {error && <p className="notice error">{error}</p>}
      <div className="import-paste-foot">
        <span className="muted small-text">
          Распознано строк: {parsed.length}
          {parsed.length >= MAX_LINES && ` (максимум ${MAX_LINES} за раз)`}
        </span>
        <button
          type="button"
          className="button"
          disabled={parsed.length === 0 || progress !== null}
          onClick={check}
        >
          {progress ? `Ищу в TMDB… ${progress.done}/${progress.total}` : "Проверить"}
        </button>
      </div>
      {progress && (
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
