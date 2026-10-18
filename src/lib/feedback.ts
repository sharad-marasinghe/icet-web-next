import "server-only";
import { sql } from "@/lib/db";
import { hashIp } from "@/lib/security";

export type FeedbackForm = { id: number; slug: string; name: string; intro_html: string; google_review_url: string; redirect_min_rating: number; thankyou_message: string; submit_label: string; is_default: boolean; is_active: boolean };
export type FeedbackQuestion = { id: number; form_id: number; question: string; field_type: "text" | "textarea" | "rating" | "yes_no" | "info"; is_required: boolean; sort_order: number };

export async function getFeedbackForm(slug?: string | null): Promise<(FeedbackForm & { questions: FeedbackQuestion[] }) | null> {
  const rows = slug
    ? await sql<FeedbackForm[]>`select * from public.feedback_forms where slug = ${slug} and is_active limit 1`
    : await sql<FeedbackForm[]>`select * from public.feedback_forms where is_active order by is_default desc, id asc limit 1`;
  const f = rows[0];
  if (!f) return null;
  const questions = await sql<FeedbackQuestion[]>`select * from public.feedback_questions where form_id = ${f.id} order by sort_order asc, id asc`;
  return { ...f, questions: questions.map((q) => ({ ...q })) };
}

export async function submitFeedback(slug: string, answers: Record<string, unknown>, meta: { ip: string; ua: string }): Promise<{ ok: true; redirect: string | null; message: string } | { ok: false; error: string }> {
  const form = await getFeedbackForm(slug);
  if (!form) return { ok: false, error: "This form is no longer available." };
  const clean: Record<string, string> = {};
  let rating: number | null = null;
  for (const q of form.questions) {
    if (q.field_type === "info") continue;
    const raw = answers[String(q.id)];
    let v = "";
    if (q.field_type === "rating") {
      const n = parseInt(String(raw ?? ""), 10);
      if (n >= 1 && n <= 5) { v = String(n); if (rating === null) rating = n; }
    } else if (q.field_type === "yes_no") {
      v = raw === "Yes" || raw === "No" ? String(raw) : "";
    } else {
      v = String(raw ?? "").replace(/<[^>]*>/g, "").trim().slice(0, q.field_type === "textarea" ? 4000 : 300);
    }
    if (q.is_required && !v) return { ok: false, error: `Please answer: ${q.question.replace(/<[^>]*>/g, "")}` };
    if (v) clean[String(q.id)] = v;
  }
  const redirect = form.google_review_url && (form.redirect_min_rating <= 0 || (rating !== null && rating >= form.redirect_min_rating)) ? form.google_review_url : null;
  await sql`insert into public.feedback_responses (form_id, answers, rating, redirected, ip_hash, user_agent)
    values (${form.id}, ${sql.json(clean as never)}, ${rating}, ${!!redirect}, ${hashIp(meta.ip)}, ${meta.ua.slice(0, 300)})`;
  return { ok: true, redirect, message: form.thankyou_message || "Thank you for your feedback!" };
}
