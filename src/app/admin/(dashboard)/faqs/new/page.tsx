import { PageHeader, Panel } from "@/components/admin/ui";
import { connection } from "next/server";
import { FaqGroupForm } from "../group-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewFaqGroup() {
  await connection();
  return (
    <>
      <PageHeader title="New FAQ group" breadcrumbs={[{ label: "FAQs", href: "/admin/faqs" }, { label: "New group" }]} description="Create the group first; you can add questions on the next screen." />
      <Panel className="max-w-2xl"><FaqGroupForm group={null} /></Panel>
    </>
  );
}
