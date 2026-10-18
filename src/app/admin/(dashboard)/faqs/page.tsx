import { CircleHelp, Plus } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PageHeader, Panel, DataTable, Pagination, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteFaqGroup } from "./actions";

type Row = { id: string; slug: string; title: string; description: string; total: number; active: number };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function FaqGroupsPage({ searchParams }: PageProps<"/admin/faqs">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const page = clampPage(sp.page);
  const where = q ? sql`where (g.title ilike ${"%" + q + "%"} or g.slug ilike ${"%" + q + "%"})` : sql``;
  const [rows, [{ count }]] = await Promise.all([
    sql<Row[]>`select g.id, g.slug, g.title, g.description, (select count(*) from public.faqs f where f.group_id = g.id)::int as total, (select count(*) from public.faqs f where f.group_id = g.id and f.is_active)::int as active from public.faq_groups g ${where} order by g.title limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.faq_groups g ${where}`,
  ]);
  return (
    <>
      <PageHeader title="FAQs" description="Questions are organised in groups. FAQ blocks and programme pages reference a group by its slug." actions={<Button href="/admin/faqs/new" size="sm"><Plus className="h-4 w-4" /> New group</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search groups…" />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/faqs/${r.id}`}
          empty={<EmptyState icon={<CircleHelp className="h-6 w-6" />} title={q ? "No groups match" : "No FAQ groups yet"} description="Create a group such as “General” or “Admissions”, then add questions to it." action={!q ? <Button href="/admin/faqs/new" size="sm"><Plus className="h-4 w-4" /> New group</Button> : undefined} />}
          columns={[
            { key: "title", header: "Group", render: (r) => <><span className="font-semibold text-slate-900">{r.title}</span>{r.description && <span className="block max-w-md truncate text-xs text-slate-500">{r.description}</span>}</> },
            { key: "slug", header: "Slug", hideBelow: "md", render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{r.slug}</code> },
            { key: "total", header: "Questions", className: "text-center", render: (r) => <span className="font-semibold text-slate-800">{r.active}<span className="font-normal text-slate-400"> / {r.total}</span></span> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24", render: (r) => <RowActions id={r.id} editHref={`/admin/faqs/${r.id}`} onDelete={deleteFaqGroup} deleteMessage={`Delete group “${r.title}” and all ${r.total} question${r.total === 1 ? "" : "s"} in it?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/faqs${qs({ q, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
