// Прокси постеров TMDB: /img/t/w342/abc.jpg → image.tmdb.org/t/p/w342/abc.jpg.
// Ответ кэшируется на CDN Vercel на год, поэтому TMDB запрашивается один раз на картинку.
import { TMDB_IMAGE_ORIGIN, TMDB_SIZES } from "@/lib/images";
import { proxyImage } from "@/lib/image-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string; file: string }> },
) {
  const { size, file } = await params;
  if (
    !(TMDB_SIZES as readonly string[]).includes(size) ||
    !/^[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp)$/.test(file)
  ) {
    return new Response("Not found", { status: 404 });
  }
  return proxyImage(`${TMDB_IMAGE_ORIGIN}/${size}/${file}`);
}
