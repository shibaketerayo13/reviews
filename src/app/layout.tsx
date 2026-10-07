import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "reviews",
  description: "Оценки и отзывы на фильмы и сериалы",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <header className="site-header">
          <a href="/" className="logo">
            reviews
          </a>
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
