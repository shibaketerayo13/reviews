"use client";

// Переключатель языка в шапке. Выбор хранится в cookie на год, страница перерисовывается на сервере.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, LOCALE_SHORT, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";

export function LangSwitch() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <div className={`lang${open ? " is-open" : ""}${pending ? " is-pending" : ""}`} ref={box}>
      <button
        type="button"
        className="lang-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.nav.language}: ${LOCALE_NAMES[locale]}`}
        title={t.lang.choose}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5Z" />
        </svg>
        <span>{LOCALE_SHORT[locale]}</span>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox" aria-label={t.lang.choose}>
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                className={`lang-option${l === locale ? " is-active" : ""}`}
                onClick={() => choose(l)}
                lang={l}
              >
                <span className="lang-code">{LOCALE_SHORT[l]}</span>
                {LOCALE_NAMES[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
