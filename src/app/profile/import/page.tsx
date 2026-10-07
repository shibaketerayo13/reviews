import Link from "next/link";
import { getProfile, requireUser } from "@/lib/auth";
import { ImportWizard } from "@/components/ImportWizard";

export const metadata = { title: "Импорт оценок · reviews" };

export default async function ImportPage() {
  await requireUser();
  const profile = await getProfile();

  return (
    <div className="import-page">
      <header className="page-head reveal">
        <p className="eyebrow">
          <Link href="/profile">Профиль</Link> · Импорт
        </p>
        <h1>
          Перенести <em>оценки</em>
        </h1>
        <p className="lead">
          Вставьте список, проверьте совпадения и сохраните. Фильмы попадут в
          профиль с вашими оценками и статусами. Уже написанные комментарии не
          изменятся.
        </p>
      </header>
      <ImportWizard isAdmin={Boolean(profile?.is_admin)} />
    </div>
  );
}
