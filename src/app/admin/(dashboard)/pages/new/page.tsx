import { PageHeader, Panel } from "@/components/admin/ui";
import { connection } from "next/server";
import { NewPageForm } from "./new-page-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewPage() {
  await connection();
  return (
    <>
      <PageHeader title="New page" breadcrumbs={[{ label: "Pages", href: "/admin/pages" }, { label: "New" }]} description="Give the page a title and URL. You will add content blocks on the next screen." />
      <Panel className="max-w-2xl">
        <NewPageForm />
      </Panel>
    </>
  );
}
