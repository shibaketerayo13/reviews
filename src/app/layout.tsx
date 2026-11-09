import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import { getProfile, getUser } from "@/lib/auth";
import { SearchBox } from "@/components/SearchBox";
import { Avatar } from "@/components/Avatar";
import { I18nProvider } from "@/components/I18nProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { getI18n } from "@/lib/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: "reviews", description: t.meta.description };
}

export const viewport: Viewport = {
  themeColor: "#0e0d0c",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, { locale, t }] = await Promise.all([getUser(), getI18n()]);
  const profile = user ? await getProfile() : null;
  const name = profile?.display_name ?? user?.email ?? "";

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <I18nProvider locale={locale} dict={t}>
        <header className="site-header">
          <div className="header-inner">
            <div className="header-left">
              <Link href="/" className="logo" aria-label={t.nav.home}>
                reviews<span className="logo-dot">.</span>
              </Link>
              <Link href="/catalog" className="nav-link">
                {t.nav.catalog}
              </Link>
            </div>

            <SearchBox />

            <nav className="nav">
              <LangSwitch />
              {profile?.is_admin && (
                <Link href="/admin" className="nav-link nav-admin">
                  {t.nav.admin}
                </Link>
              )}
              {user ? (
                <>
                  <Link href="/profile" className="nav-profile">
                    <Avatar url={profile?.avatar_url} name={name} size={30} />
                    <span className="nav-name">{name}</span>
                  </Link>
                  <form action={logout}>
                    <button type="submit" className="icon-button" aria-label={t.nav.logout} title={t.nav.logout}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                        <path d="M10 8l-4 4 4 4M6 12h10" />
                      </svg>
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="button button-small">
                  {t.nav.login}
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
          <p>{t.footer.tmdb}</p>
        </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
