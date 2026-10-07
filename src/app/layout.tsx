import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import { getProfile, getUser } from "@/lib/auth";
import { SearchBox } from "@/components/SearchBox";
import { Avatar } from "@/components/Avatar";
import { logout } from "./login/actions";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "reviews",
  description: "Дневник фильмов и сериалов: оценки, отзывы и списки",
};

export const viewport: Viewport = {
  themeColor: "#0e0d0c",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const name = profile?.display_name ?? user?.email ?? "";

  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="logo" aria-label="reviews, на главную">
              reviews<span className="logo-dot">.</span>
            </Link>

            <SearchBox />

            <nav className="nav">
              {profile?.is_admin && (
                <Link href="/admin" className="nav-link">
                  Админка
                </Link>
              )}
              {user ? (
                <>
                  <Link href="/profile" className="nav-profile">
                    <Avatar url={profile?.avatar_url} name={name} size={30} />
                    <span className="nav-name">{name}</span>
                  </Link>
                  <form action={logout}>
                    <button type="submit" className="icon-button" aria-label="Выйти" title="Выйти">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                        <path d="M10 8l-4 4 4 4M6 12h10" />
                      </svg>
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="button button-small">
                  Войти
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="container">{children}</main>

        <footer className="site-footer">
          <span className="logo small">
            reviews<span className="logo-dot">.</span>
          </span>
          <p>
            Данные о фильмах и сериалах предоставлены TMDB. Этот продукт
            использует API TMDB, но не одобрен и не сертифицирован TMDB.
          </p>
        </footer>
      </body>
    </html>
  );
}
