import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { FaqGroupForm, type FaqGroupRecord } from "../group-form";
import { QuestionsManager, type FaqRow } from "./questions-manager";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditFaqGroup({ params }: PageProps<"/admin/faqs/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[group], faqs] = await Promise.all([
    sql<FaqGroupRecord[]>`select id, slug, title, description from public.faq_groups where id = ${id}`,
    sql<FaqRow[]>`select id, question, answer, is_active, sort_order from public.faqs where group_id = ${id} order by sort_order asc, created_at asc`,
  ]);
  if (!group) notFound();
  return (
    <>
      <PageHeader title={group.title} breadcrumbs={[{ label: "FAQs", href: "/admin/faqs" }, { label: group.title }]} description={<>Group slug <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{group.slug}</code> · {faqs.length} question{faqs.length === 1 ? "" : "s"}</>} />
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Group details" className="self-start"><FaqGroupForm group={{ ...group }} /></Panel>
        <Panel title="Questions" description="Drag to reorder. Inactive questions stay here but are hidden on the website." padded>
          <QuestionsManager groupId={group.id} faqs={faqs.map((f) => ({ ...f }))} />
        </Panel>
      </div>
    </>
  );
}
