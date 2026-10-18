import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { TestimonialForm, type TestimonialRecord } from "../testimonial-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditTestimonial({ params }: PageProps<"/admin/testimonials/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[item], programs] = await Promise.all([
    sql<TestimonialRecord[]>`select id, name, role, company, quote, photo_url, video_url, program_code, rating, is_active, sort_order from public.testimonials where id = ${id}`,
    sql<{ code: string; name: string }[]>`select code, name from public.programs order by sort_order, code`,
  ]);
  if (!item) notFound();
  return <TestimonialForm item={{ ...item }} programs={programs.map((p) => ({ ...p }))} />;
}
