import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login, signup } from "./actions";

export const metadata = { title: "Вход · reviews" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await getUser()) redirect("/profile");
  const { error, message } = await searchParams;

  return (
    <div className="auth">
      <header className="page-head reveal">
        <p className="eyebrow">Аккаунт</p>
        <h1>
          Добро пожаловать <em>в зал</em>
        </h1>
        <p className="lead">
          Войдите или создайте аккаунт, чтобы вести свой дневник просмотров.
        </p>
      </header>

      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <div className="auth-grid reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <form action={login} className="panel form">
          <h2>Вход</h2>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="button">Войти</button>
        </form>

        <form action={signup} className="panel form">
          <h2>Регистрация</h2>
          <label>
            Имя на сайте
            <input name="display_name" type="text" maxLength={40} />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Пароль (от 6 символов)
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="button">Создать аккаунт</button>
        </form>
      </div>
    </div>
  );
}
