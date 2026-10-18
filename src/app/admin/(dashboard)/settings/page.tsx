import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSiteSettingsUncached } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/system/settings-form";

export const metadata: Metadata = { title: "Site settings" };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function SettingsPage() {
  await connection();
  await requireUser("admin");
  const [settings, meta] = await Promise.all([
    getSiteSettingsUncached(),
    sql<{ updated_at: string; full_name: string | null; email: string | null }[]>`
      select s.updated_at::text, p.full_name, p.email from public.site_settings s left join public.profiles p on p.id = s.updated_by where s.key = 'site'`,
  ]);
  const last = meta[0];
  return (
    <>
      <PageHeader
        title="Site settings"
        description={last ? `Last updated ${formatDateTime(last.updated_at)}${last.full_name || last.email ? ` by ${last.full_name || last.email}` : ""}.` : "Settings have not been saved yet — the site is using built-in defaults."}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Site settings" }]}
      />
      <SettingsForm initial={settings} />
    </>
  );
}
