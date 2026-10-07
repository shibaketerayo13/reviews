// Аватар пользователя: картинка или инициалы на цветном фоне.
function hueFrom(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({
  url,
  name,
  size = 36,
  className = "",
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={`avatar ${className}`}
        style={style}
      />
    );
  }
  const hue = hueFrom(name || "?");
  return (
    <span
      className={`avatar avatar-initials ${className}`}
      style={{
        ...style,
        background: `linear-gradient(135deg, hsl(${hue} 35% 32%), hsl(${(hue + 40) % 360} 30% 22%))`,
      }}
      aria-hidden="true"
    >
      {initials(name || "?")}
    </span>
  );
}
