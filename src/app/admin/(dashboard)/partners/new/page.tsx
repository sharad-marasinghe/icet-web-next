import { sql } from "@/lib/db";
import { connection } from "next/server";
import { PartnerForm } from "../partner-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewPartner() {
  await connection();
  const cats = await sql<{ category: string }[]>`select distinct category from public.partners order by category`;
  return <PartnerForm item={null} categories={cats.map((c) => c.category)} />;
}
