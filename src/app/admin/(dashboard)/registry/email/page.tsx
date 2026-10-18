import { sql } from "@/lib/db";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSmtpSettings } from "@/lib/mailer";
import { getGlobalEmailTemplates } from "@/lib/registry/service";
import { PageHeader } from "@/components/admin/ui";
import { EmailSettings, type EmailLogRow, type EntityLink } from "@/components/admin/registry/email-settings";
import { sp, type AdminPageProps } from "@/components/admin/registry/shared";
import type { EntityEmailSettings } from "@/lib/registry/fields";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EmailSettingsPage({ searchParams }: AdminPageProps) {
  await connection();
  await requireUser("admin");
  const spv = await searchParams;
  const tab = sp(spv.tab, "reg");
  const logStatus = ["sent", "failed"].includes(sp(spv.status)) ? sp(spv.status) : "";
  const [templates, smtp, log, workshops, batches] = await Promise.all([
    getGlobalEmailTemplates(),
    getSmtpSettings(),
    sql<EmailLogRow[]>`select id, to_email, subject, kind, status, error, entity_type, entity_id, created_at::text from public.email_log ${logStatus ? sql`where status = ${logStatus}` : sql``} order by created_at desc limit 100`,
    sql<{ id: number; title: string; email_settings: EntityEmailSettings }[]>`select id, title, email_settings from public.reg_workshops order by status = 'active' desc, title`,
    sql<{ id: number; batch_name: string; email_settings: EntityEmailSettings }[]>`select id, batch_name, email_settings from public.reg_batches order by is_open desc, batch_name`,
  ]);
  const customised = (e: EntityEmailSettings) => (e?.reg?.mode && e.reg.mode !== "default") || (e?.cert?.mode && e.cert.mode !== "default") || false;
  const entities: EntityLink[] = [
    ...workshops.map((w) => ({ id: w.id, label: w.title, kind: "workshop" as const, customised: customised(w.email_settings) })),
    ...batches.map((b) => ({ id: b.id, label: b.batch_name, kind: "batch" as const, customised: customised(b.email_settings) })),
  ];
  const { pass, ...smtpSafe } = smtp;
  return (
    <>
      <PageHeader title="Email settings" description="Global templates, SMTP transport and the delivery log." />
      <EmailSettings templates={templates} smtp={smtpSafe} hasPass={!!pass} log={log.map((r) => ({ ...r }))} entities={entities} initialTab={tab} logStatus={logStatus} />
    </>
  );
}
