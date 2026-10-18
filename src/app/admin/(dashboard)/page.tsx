import Link from "next/link";
import { connection } from "next/server";
import { Inbox, ClipboardList, Users, Award, CalendarDays, FileText, Ticket, TrendingUp, ArrowRight, Eye } from "lucide-react";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function AdminDashboard() {
  await connection();
  const user = await getCurrentUser();
  const [s] = await sql<Record<string, number>[]>`
    select (select count(*) from public.inquiries where status = 'new')::int as new_inquiries,
           (select count(*) from public.inquiries where created_at > now() - interval '30 days')::int as inquiries_30d,
           (select count(*) from public.reg_applications where status in ('submitted','under_review'))::int as open_applications,
           (select count(*) from public.reg_students)::int as students,
           (select count(*) from public.reg_students where registered_at > now() - interval '30 days')::int as students_30d,
           (select count(*) from public.reg_certificates where status = 'valid' and not is_suspended)::int as certificates,
           (select count(*) from public.reg_workshops where status = 'active')::int as active_workshops,
           (select count(*) from public.events where status = 'published' and start_at >= now())::int as upcoming_events,
           (select count(*) from public.pages where status = 'published')::int as pages,
           (select count(*) from public.feedback_responses where created_at > now() - interval '30 days')::int as feedback_30d`;
  const [inquiries, applications, registrations, activity] = await Promise.all([
    sql<{ id: string; name: string; type: string; program_code: string | null; status: string; created_at: string }[]>`select id, name, type, program_code, status, created_at::text from public.inquiries order by created_at desc limit 6`,
    sql<{ id: number; reference_no: string; status: string; submitted_at: string; student_name: string; batch_name: string }[]>`select a.id, a.reference_no, a.status, a.submitted_at::text, s.student_name, b.batch_name from public.reg_applications a join public.reg_students s on s.id = a.student_id join public.reg_batches b on b.id = a.batch_id order by a.submitted_at desc limit 6`,
    sql<{ id: number; student_name: string; title: string; enrolled_at: string; registration_source: string }[]>`select e.id, s.student_name, w.title, e.enrolled_at::text, e.registration_source from public.reg_enrollments e join public.reg_students s on s.id = e.student_id join public.reg_workshops w on w.id = e.workshop_id order by e.enrolled_at desc limit 6`,
    sql<{ id: number; user_email: string | null; action: string; entity: string; entity_id: string | null; created_at: string }[]>`select id, user_email, action, entity, entity_id, created_at::text from public.audit_log order by created_at desc limit 8`,
  ]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <>
      <PageHeader title={`${greet}, ${(user?.full_name || "").split(" ")[0] || "there"} 👋`} description="Here's what's happening across icet.lk." actions={<><Button href="/" external variant="outline" size="sm"><Eye className="h-4 w-4" /> View site</Button><Button href="/admin/pages" size="sm"><FileText className="h-4 w-4" /> Edit pages</Button></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New inquiries" value={s.new_inquiries} hint={`${s.inquiries_30d} in the last 30 days`} icon={<Inbox className="h-5 w-5" />} href="/admin/inquiries" />
        <StatCard label="Open applications" value={s.open_applications} hint="Submitted or under review" icon={<ClipboardList className="h-5 w-5" />} tone="amber" href="/admin/registry/applications" />
        <StatCard label="Students registered" value={s.students.toLocaleString()} hint={`+${s.students_30d} this month`} icon={<Users className="h-5 w-5" />} tone="green" href="/admin/registry/students" />
        <StatCard label="Certificates issued" value={s.certificates.toLocaleString()} hint="Valid & active" icon={<Award className="h-5 w-5" />} tone="brand" href="/admin/registry/certificates" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active workshops" value={s.active_workshops} icon={<Ticket className="h-5 w-5" />} tone="slate" href="/admin/registry/workshops" />
        <StatCard label="Upcoming events" value={s.upcoming_events} icon={<CalendarDays className="h-5 w-5" />} tone="slate" href="/admin/events" />
        <StatCard label="Feedback (30 days)" value={s.feedback_30d} icon={<TrendingUp className="h-5 w-5" />} tone="slate" href="/admin/feedback" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Latest inquiries" actions={<Link href="/admin/inquiries" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">View all <ArrowRight className="h-4 w-4" /></Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {inquiries.length === 0 && <li className="p-5 text-sm text-slate-500">No inquiries yet.</li>}
            {inquiries.map((i) => (
              <li key={i.id}><Link href={`/admin/inquiries/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div><p className="text-sm font-semibold text-slate-900">{i.name}</p><p className="text-xs text-slate-500 capitalize">{i.type}{i.program_code ? ` · ${i.program_code}` : ""} · {formatDateTime(i.created_at)}</p></div>
                <StatusBadge value={i.status} />
              </Link></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent applications" actions={<Link href="/admin/registry/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Review queue <ArrowRight className="h-4 w-4" /></Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {applications.length === 0 && <li className="p-5 text-sm text-slate-500">No applications yet.</li>}
            {applications.map((a) => (
              <li key={a.id}><Link href={`/admin/registry/applications/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div><p className="text-sm font-semibold text-slate-900">{a.student_name} <span className="font-mono text-xs text-slate-400">{a.reference_no}</span></p><p className="text-xs text-slate-500">{a.batch_name} · {formatDateTime(a.submitted_at)}</p></div>
                <StatusBadge value={a.status} />
              </Link></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Latest workshop registrations" actions={<Link href="/admin/registry/students" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Students <ArrowRight className="h-4 w-4" /></Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {registrations.length === 0 && <li className="p-5 text-sm text-slate-500">No registrations yet.</li>}
            {registrations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><p className="text-sm font-semibold text-slate-900">{r.student_name}</p><p className="text-xs text-slate-500">{r.title} · {formatDateTime(r.enrolled_at)}</p></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">{r.registration_source}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent activity" actions={<Link href="/admin/audit" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Activity log <ArrowRight className="h-4 w-4" /></Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {activity.length === 0 && <li className="p-5 text-sm text-slate-500">No activity recorded yet.</li>}
            {activity.map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <span className="font-semibold text-slate-900">{a.user_email?.split("@")[0] || "system"}</span> <span className="text-slate-600">{a.action.replace(/_/g, " ")}</span> <span className="text-slate-500">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}</span>
                <span className="ml-2 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
