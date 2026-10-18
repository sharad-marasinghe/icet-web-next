import { sql } from "@/lib/db";
import { connection } from "next/server";
import type { Category } from "@/components/admin/content/category-manager";
import { EventForm, type WorkshopOption } from "../event-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewEvent() {
  await connection();
  const [categories, workshops, faqGroups] = await Promise.all([
    sql<Category[]>`select id, slug, name, color from public.event_categories order by name`,
    sql<WorkshopOption[]>`select id, slug, title, status::text from public.reg_workshops order by status, starts_at desc nulls last, id desc`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
  ]);
  return <EventForm event={null} categories={categories.map((c) => ({ ...c }))} workshops={workshops.map((w) => ({ ...w }))} faqGroups={faqGroups.map((g) => ({ ...g }))} />;
}
