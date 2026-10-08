// Прокси аватаров из Supabase Storage: /img/a/<id пользователя>/<файл>.
// Имена файлов уникальны (avatar-<время>.jpg), поэтому их можно кэшировать надолго.
import { proxyImage } from "@/lib/image-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ user: string; file: string }> },
) {
  const { user, file } = await params;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !base ||
    !/^[0-9a-f-]{36}$/.test(user) ||
    !/^[A-Za-z0-9_.-]{1,80}\.(?:jpg|jpeg|png|webp|gif)$/.test(file) ||
    file.includes("..")
  ) {
    return new Response("Not found", { status: 404 });
  }
  return proxyImage(`${base}/storage/v1/object/public/avatars/${user}/${file}`);
}
