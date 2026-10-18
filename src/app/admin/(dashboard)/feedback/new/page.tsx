import { PageHeader } from "@/components/admin/ui";
import { connection } from "next/server";
import { FeedbackSettingsForm } from "@/components/admin/feedback/feedback-editor";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewFeedbackFormPage() {
  await connection();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="New feedback form" breadcrumbs={[{ label: "Feedback", href: "/admin/feedback" }, { label: "New" }]} description="After creating the form you will be taken to its questions." />
      <FeedbackSettingsForm form={null} siteUrl={siteUrl} />
    </>
  );
}
