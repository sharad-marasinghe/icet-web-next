import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { cn } from "@/lib/utils";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import type { FeedbackForm, FeedbackQuestion } from "@/lib/feedback";
import { FeedbackSettingsForm, QuestionsManager, ResponsesTable, type ResponseRow } from "@/components/admin/feedback/feedback-editor";
import { sp, spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";

const PER = 25;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function FeedbackFormPage({ params, searchParams }: AdminPageProps<{ id: string }>) {
  await connection();
  const { id } = await params;
  const spv = await searchParams;
  const formId = parseInt(id, 10);
  if (!Number.isFinite(formId)) notFound();
  const tab = ["settings", "questions", "responses"].includes(sp(spv.tab)) ? sp(spv.tab) : "settings";
  const rating = ["1", "2", "3", "4", "5", "none"].includes(sp(spv.rating)) ? sp(spv.rating) : "";
  const page = Math.max(1, spInt(spv.page, 1));
  const user = await getCurrentUser();
  const form = (await sql<FeedbackForm[]>`select * from public.feedback_forms where id = ${formId}`)[0];
  if (!form) notFound();
  const [questions, stats] = await Promise.all([
    sql<FeedbackQuestion[]>`select * from public.feedback_questions where form_id = ${formId} order by sort_order, id`,
    sql<{ total: number; avg: number | null; r5: number; r4: number; r3: number; r2: number; r1: number; none: number }[]>`select count(*)::int as total, avg(rating)::float as avg,
      count(*) filter (where rating = 5)::int as r5, count(*) filter (where rating = 4)::int as r4, count(*) filter (where rating = 3)::int as r3, count(*) filter (where rating = 2)::int as r2, count(*) filter (where rating = 1)::int as r1, count(*) filter (where rating is null)::int as none
      from public.feedback_responses where form_id = ${formId}`,
  ]);
  const s = stats[0];
  const counts = { "5": s.r5, "4": s.r4, "3": s.r3, "2": s.r2, "1": s.r1, none: s.none };
  const shown = rating ? counts[rating as keyof typeof counts] : s.total;
  const responses = tab === "responses"
    ? await sql<ResponseRow[]>`select id, created_at::text, rating, redirected, answers from public.feedback_responses where form_id = ${formId} ${rating === "none" ? sql`and rating is null` : rating ? sql`and rating = ${Number(rating)}` : sql``} order by created_at desc limit ${PER} offset ${(page - 1) * PER}`
    : [];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const tabs = [["settings", "Settings", null], ["questions", "Questions", questions.length], ["responses", "Responses", s.total]] as const;
  return (
    <>
      <PageHeader title={<span className="inline-flex items-center gap-3">{form.name} <StatusBadge value={form.is_active ? "active" : "inactive"} /></span>} breadcrumbs={[{ label: "Feedback", href: "/admin/feedback" }, { label: form.name }]} description={spv.created ? "Form created. Add your questions below — start with a star rating." : `/feedback/${form.slug}`} />
      <div className="scrollbar-none -mb-px mb-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map(([t, label, n]) => (
          <Link key={t} href={`/admin/feedback/${formId}${qs({ tab: t })}`} role="tab" aria-selected={tab === t} className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {label}{typeof n === "number" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{n}</span>}
          </Link>
        ))}
      </div>
      {tab === "settings" && <FeedbackSettingsForm form={{ ...form }} siteUrl={siteUrl} />}
      {tab === "questions" && <QuestionsManager formId={formId} questions={questions.map((q) => ({ ...q }))} />}
      {tab === "responses" && <ResponsesTable formId={formId} rows={responses.map((r) => ({ ...r }))} questions={questions.map((q) => ({ ...q }))} total={s.total} avg={s.avg} counts={counts} rating={rating} page={page} pages={Math.max(1, Math.ceil(shown / PER))} isAdmin={hasRole(user, "admin")} />}
    </>
  );
}
