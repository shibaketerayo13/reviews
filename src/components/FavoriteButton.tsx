"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/profile/actions";

/** Сердечко «в любимые». Меняется сразу, при ошибке откатывается. */
export function FavoriteButton({
  titleId,
  initial,
  withLabel = false,
  onChange,
}: {
  titleId: number;
  initial: boolean;
  withLabel?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function click() {
    const next = !fav;
    setFav(next);
    setBusy(true);
    const res = await toggleFavorite(titleId, next);
    setBusy(false);
    if (!res.ok) {
      setFav(!next);
      return;
    }
    onChange?.(next);
    startTransition(() => router.refresh());
  }

  const label = fav ? "Убрать из любимых" : "В любимые";
  return (
    <button
      type="button"
      className={`fav-button${fav ? " is-on" : ""}${withLabel ? " with-label" : ""}`}
      onClick={click}
      disabled={busy}
      aria-pressed={fav}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3s-7.3-4.4-9.2-9A5.2 5.2 0 0 1 12 6.1a5.2 5.2 0 0 1 9.2 5.2c-1.9 4.6-9.2 9-9.2 9z" />
      </svg>
      {withLabel && <span>{fav ? "В любимых" : "В любимые"}</span>}
    </button>
  );
}
