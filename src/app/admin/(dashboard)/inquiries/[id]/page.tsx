import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSiteSettingsUncached } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { KeyValueList } from "@/components/admin/system/helpers";
import { InquiryActions, NotesPanel } from "@/components/admin/inquiries/detail";
import { telLink } from "@/components/admin/inquiries/links";

export const metadata: Metadata = { title: "Inquiry" };

type Inquiry = {
  id: string; type: string; name: string; email: string; phone: string; whatsapp: string; program_code: string | null; intake: string | null; message: string;
  data: Record<string, unknown>; utm: Record<string, string>; page_path: string | null; status: string; assigned_to: string | null; notes: string; created_at: string; updated_at: string;
};
const TYPE_TONE: Record<string, string> = { apply: "brand", contact: "slate", callback: "amber", brochure: "green" };
const label = (k: string) => k.replace(/_/g, " ").replace(/\b(ol|al)\b/gi, (m) => m.toUpperCase().split("").join("/")).replace(/^./, (c) => c.toUpperCase());

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const me = await requireUser("viewer");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [rows, staff, settings] = await Promise.all([
    sql<Inquiry[]>`select id, type, name, email, phone, whatsapp, program_code, intake, message, data, utm, page_path, status, assigned_to, notes, created_at::text, updated_at::text from public.inquiries where id = ${id}`,
    sql<{ id: string; full_name: string; email: string }[]>`select id, full_name, email from public.profiles where is_active order by full_name, email`,
    getSiteSettingsUncached(),
  ]);
  const inq = rows[0];
  if (!inq) notFound();
  const program = inq.program_code ? (await sql<{ name: string; slug: string }[]>`select name, slug from public.programs where code = ${inq.program_code} limit 1`)[0] : null;
  const firstName = inq.name.split(" ")[0];
  const waMessage = `Hi ${firstName}, this is ${me.full_name || "the admissions team"} from iCET. Thank you for your interest in ${program?.name || inq.program_code || "our programmes"}${inq.intake ? ` (${inq.intake})` : ""}. When would be a good time to talk? You can also reach us on ${settings.phone_display}.`;
  const emailSubject = `Your enquiry to iCET${program ? ` – ${program.name}` : ""}`;
  const emailBody = `Dear ${firstName},\n\nThank you for contacting iCET${program ? ` about the ${program.name}` : ""}. I would be happy to share more details and answer any questions.\n\nHotline / WhatsApp: ${settings.phone_display}\n\nKind regards,\n${me.full_name || "Admissions Team"}\niCET – Institute of Computer Engineering Technology`;
  const dataEntries = Object.entries(inq.data || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  const utmEntries = Object.entries(inq.utm || {}).filter(([, v]) => v);

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{inq.name} <StatusBadge value={inq.status} /></span>}
        description={<>Received {formatDateTime(inq.created_at)}{inq.updated_at !== inq.created_at ? ` · updated ${formatDateTime(inq.updated_at)}` : ""}</>}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Inquiries", href: "/admin/inquiries" }, { label: inq.name }]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Contact details">
            <KeyValueList items={[
              { label: "Type", value: <StatusBadge value={inq.type} map={TYPE_TONE} /> },
              { label: "Name", value: <span className="font-semibold">{inq.name}</span> },
              { label: "Email", value: inq.email ? <a href={`mailto:${inq.email}`} className="text-brand-700 hover:underline">{inq.email}</a> : null },
              { label: "Phone", value: inq.phone ? <a href={telLink(inq.phone)} className="text-brand-700 hover:underline">{inq.phone}</a> : null },
              { label: "WhatsApp", value: inq.whatsapp && inq.whatsapp !== inq.phone ? inq.whatsapp : null },
              { label: "Programme", value: inq.program_code ? <span className="inline-flex items-center gap-2"><span className="rounded-md bg-navy px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{inq.program_code}</span>{program?.name}{program && <a href={`/${program.slug}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-700" aria-label="Open programme page"><ExternalLink className="h-3.5 w-3.5" /></a>}</span> : null },
              { label: "Intake", value: inq.intake },
              { label: "Message", value: inq.message ? <p className="whitespace-pre-wrap">{inq.message}</p> : null },
            ]} />
          </Panel>
          <Panel title="Additional details" description="Everything else the visitor entered on the form.">
            {dataEntries.length ? <KeyValueList items={dataEntries.map(([k, v]) => ({ label: label(k), value: typeof v === "object" ? <code className="text-xs">{JSON.stringify(v)}</code> : <span className="whitespace-pre-wrap">{String(v)}</span> }))} /> : <p className="text-sm text-slate-500">No additional fields were submitted.</p>}
          </Panel>
          <NotesPanel id={inq.id} notes={inq.notes} />
        </div>
        <div className="space-y-6">
          <InquiryActions id={inq.id} status={inq.status} assignedTo={inq.assigned_to} staff={staff.map((s) => ({ ...s }))} phone={inq.phone} whatsapp={inq.whatsapp} email={inq.email} waMessage={waMessage} emailSubject={emailSubject} emailBody={emailBody} canDelete={me.role === "admin" || me.role === "super_admin"} />
          <Panel title="Source">
            <KeyValueList items={[
              { label: "Page", value: inq.page_path ? <Link href={inq.page_path} target="_blank" className="break-all font-mono text-xs text-brand-700 hover:underline">{inq.page_path}</Link> : null },
              ...utmEntries.map(([k, v]) => ({ label: k.replace("utm_", "UTM "), value: <span className="font-mono text-xs">{v}</span> })),
            ]} />
            {!inq.page_path && !utmEntries.length && <p className="text-sm text-slate-500">No tracking information captured.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
