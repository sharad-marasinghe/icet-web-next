import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BatchEditor } from "@/components/admin/registry/batch-editor";
import { getBatchById, getGlobalEmailTemplates } from "@/lib/registry/service";
import type { AdminPageProps } from "@/components/admin/registry/shared";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditBatchPage({ params, searchParams }: AdminPageProps<{ id: string }>) {
  await connection();
  const { id } = await params;
  const spv = await searchParams;
  const batchId = parseInt(id, 10);
  if (!Number.isFinite(batchId)) notFound();
  const batch = await getBatchById(batchId);
  if (!batch) notFound();
  const [globalTemplates, [{ count }]] = await Promise.all([getGlobalEmailTemplates(), sql<{ count: number }[]>`select count(*)::int from public.reg_applications where batch_id = ${batchId}`]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title={batch.batch_name} breadcrumbs={[{ label: "Registry" }, { label: "Academic batches", href: "/admin/registry/batches" }, { label: "Edit" }]} description={spv.created ? "Batch created. Share the public URL or embed the form on a page." : `Editing batch #${batch.id}`} />
      <BatchEditor batch={batch} siteUrl={siteUrl} globalTemplates={globalTemplates} applications={count} />
    </>
  );
}
