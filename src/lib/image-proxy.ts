// Общая часть прокси картинок: скачать с источника и отдать с долгим кэшем.
const YEAR = 60 * 60 * 24 * 365;

export async function proxyImage(url: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(url, { cache: "no-store" });
  } catch {
    return new Response("Upstream unavailable", { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return new Response("Not found", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      // Браузер и CDN Vercel держат картинку год: повторно к источнику не ходим
      "Cache-Control": `public, max-age=${YEAR}, s-maxage=${YEAR}, immutable`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
