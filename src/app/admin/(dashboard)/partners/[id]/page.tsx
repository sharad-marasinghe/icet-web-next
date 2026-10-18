import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { PartnerForm, type PartnerRecord } from "../partner-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditPartner({ params }: PageProps<"/admin/partners/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[item], cats] = await Promise.all([
    sql<PartnerRecord[]>`select id, name, logo_url, website_url, category, is_active, sort_order from public.partners where id = ${id}`,
    sql<{ category: string }[]>`select distinct category from public.partners order by category`,
  ]);
  if (!item) notFound();
  return <PartnerForm item={{ ...item }} categories={cats.map((c) => c.category)} />;
}
