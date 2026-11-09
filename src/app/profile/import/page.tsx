import Link from "next/link";
import { getProfile, requireUser } from "@/lib/auth";
import { ImportWizard } from "@/components/ImportWizard";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.meta.import} · reviews` };
}

export default async function ImportPage() {
  await requireUser();
  const profile = await getProfile();
  const { t } = await getI18n();
  const im = t.import;

  return (
    <div className="import-page">
      <header className="page-head reveal">
        <p className="eyebrow">
          <Link href="/profile">{im.crumbProfile}</Link> · {im.crumbImport}
        </p>
        <h1>
          {im.titleStart}
          <em>{im.titleAccent}</em>
        </h1>
        <p className="lead">{im.lead}</p>
      </header>
      <ImportWizard isAdmin={Boolean(profile?.is_admin)} />
    </div>
  );
}
