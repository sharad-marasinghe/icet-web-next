import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import type { Category } from "@/components/admin/content/category-manager";
import { EventForm, type EventFull, type WorkshopOption } from "../event-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditEvent({ params }: PageProps<"/admin/events/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[event], categories, workshops, faqGroups] = await Promise.all([
    sql<EventFull[]>`select id, slug, title, excerpt, content, start_at::text, end_at::text, all_day, venue, address, is_online, image_url, cost, registration_url, workshop_id, category_ids, speakers, status::text, is_featured, seo, updated_at::text from public.events where id = ${id}`,
    sql<Category[]>`select id, slug, name, color from public.event_categories order by name`,
    sql<WorkshopOption[]>`select id, slug, title, status::text from public.reg_workshops order by status, starts_at desc nulls last, id desc`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
  ]);
  if (!event) notFound();
  return <EventForm event={{ ...event, speakers: Array.isArray(event.speakers) ? event.speakers : [], seo: event.seo || {} }} categories={categories.map((c) => ({ ...c }))} workshops={workshops.map((w) => ({ ...w }))} faqGroups={faqGroups.map((g) => ({ ...g }))} />;
}
