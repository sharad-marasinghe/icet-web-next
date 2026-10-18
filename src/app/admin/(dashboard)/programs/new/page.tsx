import { sql } from "@/lib/db";
import { connection } from "next/server";
import { ProgramForm } from "../program-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewProgram() {
  await connection();
  const faqGroups = await sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`;
  return <ProgramForm program={null} faqGroups={faqGroups.map((g) => ({ ...g }))} />;
}
