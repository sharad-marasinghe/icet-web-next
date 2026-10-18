import { sql } from "@/lib/db";
import { connection } from "next/server";
import { TestimonialForm } from "../testimonial-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewTestimonial() {
  await connection();
  const programs = await sql<{ code: string; name: string }[]>`select code, name from public.programs order by sort_order, code`;
  return <TestimonialForm item={null} programs={programs.map((p) => ({ ...p }))} />;
}
