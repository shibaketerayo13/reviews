"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, setAvatar } from "@/app/profile/actions";
import { Avatar } from "./Avatar";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function AvatarUploader({
  userId,
  name,
  url,
}: {
  userId: string;
  name: string;
  url: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFile(file: File) {
    setError(null);
    const ext = TYPES[file.type];
    if (!ext) return setError("Подойдут JPG, PNG, WebP или GIF");
    if (file.size > MAX_BYTES) return setError("Файл больше 2 МБ");

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw new Error(uploadError.message);

      const result = await setAvatar(path);
      if (!result.ok) throw new Error(result.error);
      startTransition(() => router.refresh());
    } catch (e) {
      setPreview(null);
      setError(
        e instanceof Error ? `Не удалось загрузить: ${e.message}` : "Не удалось загрузить",
      );
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localUrl);
      if (input.current) input.current.value = "";
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    const result = await removeAvatar();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPreview(null);
    startTransition(() => router.refresh());
  }

  const shown = preview ?? url;

  return (
    <div className="avatar-uploader">
      <button
        type="button"
        className={`avatar-button${busy ? " is-busy" : ""}`}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Сменить аватар"
      >
        <Avatar url={shown} name={name} size={112} />
        <span className="avatar-overlay">{busy ? "Загрузка…" : "Сменить"}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      {url && !busy && (
        <button type="button" className="link-button subtle" onClick={onRemove}>
          Удалить фото
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
