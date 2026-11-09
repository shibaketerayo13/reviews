import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { login, signup } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.meta.login} · reviews` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await getUser()) redirect("/profile");
  const { error, message } = await searchParams;
  const { t } = await getI18n();
  const l = t.login;

  return (
    <div className="auth">
      <header className="page-head reveal">
        <p className="eyebrow">{l.eyebrow}</p>
        <h1>
          {l.titleStart}
          <em>{l.titleAccent}</em>
        </h1>
        <p className="lead">{l.lead}</p>
      </header>

      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <div className="auth-grid reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <form action={login} className="panel form">
          <h2>{l.signIn}</h2>
          <label>
            {l.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {l.password}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="button">{l.submitLogin}</button>
        </form>

        <form action={signup} className="panel form">
          <h2>{l.signUp}</h2>
          <label>
            {l.displayName}
            <input name="display_name" type="text" maxLength={40} />
          </label>
          <label>
            {l.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {l.newPassword}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="button">{l.submitSignup}</button>
        </form>
      </div>
    </div>
  );
}
