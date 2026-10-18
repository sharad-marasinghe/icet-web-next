import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { WorkshopEditor } from "@/components/admin/registry/workshop-editor";
import { getGlobalEmailTemplates, getWorkshopById } from "@/lib/registry/service";
import type { AdminPageProps } from "@/components/admin/registry/shared";
import type { SourceCount } from "@/components/admin/registry/tracking-links";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditWorkshopPage({ params, searchParams }: AdminPageProps<{ id: string }>) {
  await connection();
  const { id } = await params;
  const spv = await searchParams;
  const workshopId = parseInt(id, 10);
  if (!Number.isFinite(workshopId)) notFound();
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) notFound();
  const [globalTemplates, sources, [{ count }]] = await Promise.all([
    getGlobalEmailTemplates(),
    sql<SourceCount[]>`select coalesce(nullif(registration_source, ''), 'direct') as source, count(*)::int as count from public.reg_enrollments where workshop_id = ${workshopId} group by 1 order by 2 desc`,
    sql<{ count: number }[]>`select count(*)::int from public.reg_enrollments where workshop_id = ${workshopId}`,
  ]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title={workshop.title} breadcrumbs={[{ label: "Registry" }, { label: "Workshops", href: "/admin/registry/workshops" }, { label: "Edit" }]} description={spv.created ? "Workshop created. Tracking links are now available below." : `Editing workshop #${workshop.id}`} />
      <WorkshopEditor workshop={workshop} siteUrl={siteUrl} globalTemplates={globalTemplates} sources={sources.map((s) => ({ ...s }))} registrations={count} />
    </>
  );
}
