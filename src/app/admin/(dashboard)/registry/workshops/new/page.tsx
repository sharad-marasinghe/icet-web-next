import { PageHeader } from "@/components/admin/ui";
import { connection } from "next/server";
import { WorkshopEditor } from "@/components/admin/registry/workshop-editor";
import { getGlobalEmailTemplates } from "@/lib/registry/service";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewWorkshopPage() {
  await connection();
  const globalTemplates = await getGlobalEmailTemplates();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="New workshop" breadcrumbs={[{ label: "Registry" }, { label: "Workshops", href: "/admin/registry/workshops" }, { label: "New" }]} description="Set up the registration form, certificate layout and emails. Tracking links appear after the first save." />
      <WorkshopEditor workshop={null} siteUrl={siteUrl} globalTemplates={globalTemplates} sources={[]} registrations={0} />
    </>
  );
}
