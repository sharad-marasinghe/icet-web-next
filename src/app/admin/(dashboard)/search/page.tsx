import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Search, UserRound, ClipboardList, Inbox, FileText, CalendarDays, Newspaper, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageHeader, Panel, SearchBox, StatusBadge, EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Search" };

type Hit = { id: string | number; title: string; subtitle: string; href: string; status?: string; date?: string };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await requireUser("viewer");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");
  const phoneLike = digits.length >= 5 ? `%${digits.slice(-9)}%` : null;

  let groups: { key: string; label: string; icon: React.ElementType; more?: string; hits: Hit[] }[] = [];
  if (q.length >= 2) {
    const [students, applications, inquiries, pages, events, posts, workshops] = await Promise.all([
      sql<{ id: number; student_id: string; student_name: string; student_email: string; student_phone: string | null; registered_at: string }[]>`
        select id, student_id, student_name, student_email, student_phone, registered_at::text from public.reg_students
        where student_id ilike ${like} or student_name ilike ${like} or student_email ilike ${like} ${phoneLike ? sql`or regexp_replace(coalesce(student_phone,''), '\\D', '', 'g') like ${phoneLike}` : sql``}
        order by registered_at desc limit 10`,
      sql<{ id: number; reference_no: string; status: string; submitted_at: string; student_name: string; batch_name: string }[]>`
        select a.id, a.reference_no, a.status, a.submitted_at::text, s.student_name, b.batch_name from public.reg_applications a
        join public.reg_students s on s.id = a.student_id join public.reg_batches b on b.id = a.batch_id
        where a.reference_no ilike ${like} or s.student_name ilike ${like} or s.student_email ilike ${like} order by a.submitted_at desc limit 10`,
      sql<{ id: string; name: string; email: string; phone: string; type: string; status: string; program_code: string | null; created_at: string }[]>`
        select id, name, email, phone, type, status, program_code, created_at::text from public.inquiries
        where name ilike ${like} or email ilike ${like} ${phoneLike ? sql`or regexp_replace(phone, '\\D', '', 'g') like ${phoneLike} or regexp_replace(whatsapp, '\\D', '', 'g') like ${phoneLike}` : sql``}
        order by created_at desc limit 10`,
      sql<{ id: string; title: string; slug: string; status: string; updated_at: string }[]>`select id, title, slug, status, updated_at::text from public.pages where title ilike ${like} or slug ilike ${like} order by updated_at desc limit 10`,
      sql<{ id: string; title: string; slug: string; status: string; start_at: string }[]>`select id, title, slug, status, start_at::text from public.events where title ilike ${like} or slug ilike ${like} order by start_at desc limit 10`,
      sql<{ id: string; title: string; slug: string; status: string; published_at: string | null }[]>`select id, title, slug, status, published_at::text from public.posts where title ilike ${like} or slug ilike ${like} order by coalesce(published_at, created_at) desc limit 10`,
      sql<{ id: number; title: string; slug: string; status: string; starts_at: string | null }[]>`select id, title, slug, status, starts_at::text from public.reg_workshops where title ilike ${like} or slug ilike ${like} order by created_at desc limit 10`,
    ]);
    groups = [
      { key: "students", label: "Students", icon: UserRound, more: `/admin/registry/students?q=${encodeURIComponent(q)}`, hits: students.map((s) => ({ id: s.id, title: s.student_name, subtitle: `${s.student_id} · ${s.student_email}${s.student_phone ? ` · ${s.student_phone}` : ""}`, href: `/admin/registry/students?q=${encodeURIComponent(s.student_id)}`, date: s.registered_at })) },
      { key: "applications", label: "Applications", icon: ClipboardList, more: `/admin/registry/applications?q=${encodeURIComponent(q)}`, hits: applications.map((a) => ({ id: a.id, title: a.student_name, subtitle: `${a.reference_no} · ${a.batch_name}`, href: `/admin/registry/applications/${a.id}`, status: a.status, date: a.submitted_at })) },
      { key: "inquiries", label: "Inquiries", icon: Inbox, more: `/admin/inquiries?q=${encodeURIComponent(q)}`, hits: inquiries.map((i) => ({ id: i.id, title: i.name, subtitle: [i.type, i.program_code, i.email, i.phone].filter(Boolean).join(" · "), href: `/admin/inquiries/${i.id}`, status: i.status, date: i.created_at })) },
      { key: "pages", label: "Pages", icon: FileText, hits: pages.map((p) => ({ id: p.id, title: p.title, subtitle: `/${p.slug === "home" ? "" : p.slug}`, href: `/admin/pages/${p.id}`, status: p.status, date: p.updated_at })) },
      { key: "events", label: "Events", icon: CalendarDays, hits: events.map((e) => ({ id: e.id, title: e.title, subtitle: `/events/${e.slug}`, href: `/admin/events/${e.id}`, status: e.status, date: e.start_at })) },
      { key: "posts", label: "Blog posts", icon: Newspaper, hits: posts.map((p) => ({ id: p.id, title: p.title, subtitle: `/blogs/${p.slug}`, href: `/admin/posts/${p.id}`, status: p.status, date: p.published_at || undefined })) },
      { key: "workshops", label: "Workshops", icon: Ticket, hits: workshops.map((w) => ({ id: w.id, title: w.title, subtitle: `/register/${w.slug}`, href: `/admin/registry/workshops/${w.id}`, status: w.status, date: w.starts_at || undefined })) },
    ];
  }
  const total = groups.reduce((n, g) => n + g.hits.length, 0);

  return (
    <>
      <PageHeader title="Search" description={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”${total >= 10 ? " (showing the first 10 per group)" : ""}` : "Find students, applications, inquiries and content across the admin."} breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Search" }]} />
      <form className="mb-6 max-w-xl"><SearchBox defaultValue={q} placeholder="Name, email, phone, reference no, student ID, page title…" /></form>
      {q.length < 2 ? (
        <EmptyState icon={<Search className="h-7 w-7" />} title="Type at least two characters" description="Searches students (ID, name, email, phone), applications, inquiries, pages, events, blog posts and workshops." />
      ) : total === 0 ? (
        <EmptyState icon={<Search className="h-7 w-7" />} title={`No matches for “${q}”`} description="Check the spelling or try a shorter term — phone numbers match on their last digits." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.filter((g) => g.hits.length).map((g) => (
            <Panel key={g.key} padded={false} title={<span className="inline-flex items-center gap-2"><g.icon className="h-4 w-4 text-brand-600" /> {g.label} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{g.hits.length}{g.hits.length >= 10 ? "+" : ""}</span></span>}
              actions={g.more && g.hits.length >= 10 ? <Link href={g.more} className="text-sm font-semibold text-brand-700 hover:underline">See all</Link> : undefined}>
              <ul className="divide-y divide-slate-100">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-brand-50/40">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{h.title}</p><p className="truncate text-xs text-slate-500">{h.subtitle}</p></div>
                      <div className="flex shrink-0 items-center gap-2">{h.status && <StatusBadge value={h.status} />}{h.date && <span className="hidden text-xs text-slate-400 sm:inline">{formatDate(h.date)}</span>}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
