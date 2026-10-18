import { Plus, MessageSquareHeart, Star } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, DataTable, StatusBadge, EmptyState } from "@/components/admin/ui";
import { FeedbackRowActions } from "@/components/admin/feedback/feedback-row-actions";
import { CopyButton } from "@/components/admin/registry/copy-button";

type Row = { id: number; name: string; slug: string; is_default: boolean; is_active: boolean; google_review_url: string; redirect_min_rating: number; questions: number; responses: number; avg_rating: number | null };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function FeedbackFormsPage() {
  await connection();
  const user = await getCurrentUser();
  const rows = await sql<Row[]>`select f.id, f.name, f.slug, f.is_default, f.is_active, f.google_review_url, f.redirect_min_rating,
      (select count(*) from public.feedback_questions q where q.form_id = f.id)::int as questions,
      (select count(*) from public.feedback_responses r where r.form_id = f.id)::int as responses,
      (select round(avg(rating)::numeric, 2) from public.feedback_responses r where r.form_id = f.id and rating is not null)::float as avg_rating
    from public.feedback_forms f order by f.is_default desc, f.name`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="Feedback forms" description="Collect private feedback and send happy respondents to Google Reviews." actions={<Button href="/admin/feedback/new" size="sm"><Plus className="h-4 w-4" /> New form</Button>} />
      <Panel padded={false}>
        <div className="p-5">
          <DataTable<Row>
            rows={rows.map((r) => ({ ...r }))}
            empty={<EmptyState icon={<MessageSquareHeart className="h-7 w-7" />} title="No feedback forms yet" description="Create a form, add a star-rating question and embed it with a Form block or share its public URL." action={<Button href="/admin/feedback/new" size="sm"><Plus className="h-4 w-4" /> New form</Button>} />}
            columns={[
              { key: "name", header: "Form", render: (r) => <div><p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">{r.name}{r.is_default && <span title="Default form"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span>}</p><div className="mt-1 flex items-center gap-2"><code className="text-[11px] text-slate-500">/feedback/{r.slug}</code><CopyButton value={`${siteUrl}/feedback/${r.slug}`} label="Copy URL" size="xs" /></div></div> },
              { key: "questions", header: "Questions", hideBelow: "md", render: (r) => <span className="text-slate-700">{r.questions}</span> },
              { key: "responses", header: "Responses", render: (r) => <div><span className="font-semibold text-slate-900">{r.responses}</span>{r.avg_rating !== null && <p className="text-[11px] text-slate-500">avg {Number(r.avg_rating).toFixed(2)} ★</p>}</div> },
              { key: "redirect", header: "Redirect rule", hideBelow: "lg", render: (r) => <span className="text-xs text-slate-600">{!r.google_review_url ? "Never (no link)" : r.redirect_min_rating === 0 ? "Always redirect" : `Rating ≥ ${r.redirect_min_rating}★`}</span> },
              { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
              { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => <FeedbackRowActions id={r.id} name={r.name} isDefault={r.is_default} isAdmin={hasRole(user, "admin")} /> },
            ]}
          />
        </div>
      </Panel>
    </>
  );
}
