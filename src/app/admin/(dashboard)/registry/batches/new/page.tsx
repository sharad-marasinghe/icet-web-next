import { PageHeader } from "@/components/admin/ui";
import { connection } from "next/server";
import { BatchEditor } from "@/components/admin/registry/batch-editor";
import { getGlobalEmailTemplates } from "@/lib/registry/service";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewBatchPage() {
  await connection();
  const globalTemplates = await getGlobalEmailTemplates();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="New academic batch" breadcrumbs={[{ label: "Registry" }, { label: "Academic batches", href: "/admin/registry/batches" }, { label: "New" }]} />
      <BatchEditor batch={null} siteUrl={siteUrl} globalTemplates={globalTemplates} applications={0} />
    </>
  );
}
