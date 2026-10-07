"use client";

import { useState } from "react";

/** Ссылка на публичный профиль и кнопка «Скопировать». */
export function ShareProfile({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/u/${username}`;

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Старые браузеры: через временное поле
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="share">
      <a href={path} className="share-link" target="_blank" rel="noreferrer">
        {path}
      </a>
      <button type="button" className="button button-small button-ghost" onClick={copy}>
        {copied ? "Скопировано ✓" : "Поделиться"}
      </button>
    </div>
  );
}
