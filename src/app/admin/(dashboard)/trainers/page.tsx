import { Users, Plus } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PageHeader, Panel, Pagination, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { TrainerList, type TrainerRow } from "./trainer-list";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function TrainersPage({ searchParams }: PageProps<"/admin/trainers">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (name ilike ${"%" + q + "%"} or title ilike ${"%" + q + "%"})` : sql``} ${status === "active" ? sql`and is_active` : status === "inactive" ? sql`and not is_active` : status === "featured" ? sql`and is_featured` : sql``}`;
  const [rows, [{ count }]] = await Promise.all([
    sql<TrainerRow[]>`select id, slug, name, title, photo_url, is_featured, is_active, sort_order from public.trainers ${where} order by sort_order asc, name asc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.trainers ${where}`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/trainers${qs({ q })}`, active: !status },
    { label: "Featured", href: `/admin/trainers${qs({ q, status: "featured" })}`, active: status === "featured" },
    { label: "Active", href: `/admin/trainers${qs({ q, status: "active" })}`, active: status === "active" },
    { label: "Inactive", href: `/admin/trainers${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  const canReorder = !q && !status;
  return (
    <>
      <PageHeader title="Trainers" description="Panel of lecturers shown on the About and programme pages. Drag to set the display order." actions={<Button href="/admin/trainers/new" size="sm"><Plus className="h-4 w-4" /> New trainer</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search name or designation…" tabs={tabs} hidden={{ status }} />
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title={canReorder ? "No trainers yet" : "No trainers match"} description={canReorder ? "Add the first member of the teaching panel." : "Try a different search or filter."} action={canReorder ? <Button href="/admin/trainers/new" size="sm"><Plus className="h-4 w-4" /> New trainer</Button> : undefined} />
        ) : (
          <TrainerList rows={rows.map((r) => ({ ...r }))} offset={(page - 1) * PER_PAGE} canReorder={canReorder} />
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/trainers${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
