import type { Metadata } from "next";
import Link from "next/link";
import { getProfile, getUser } from "@/lib/auth";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "reviews",
  description: "Оценки и отзывы на фильмы и сериалы",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  return (
    <html lang="ru">
      <body>
        <header className="site-header">
          <Link href="/" className="logo">
            reviews
          </Link>
          <form action="/search" className="header-search">
            <input
              name="q"
              type="search"
              placeholder="Фильм или сериал…"
              aria-label="Поиск"
            />
          </form>
          <nav className="nav">
            {profile?.is_admin && <Link href="/admin">Админка</Link>}
            {user ? (
              <>
                <Link href="/profile">
                  {profile?.display_name ?? "Профиль"}
                </Link>
                <form action={logout}>
                  <button type="submit" className="link-button">
                    Выйти
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login">Войти</Link>
            )}
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          Данные о фильмах и сериалах предоставлены TMDB. Этот продукт
          использует API TMDB, но не одобрен и не сертифицирован TMDB.
        </footer>
      </body>
    </html>
  );
}
