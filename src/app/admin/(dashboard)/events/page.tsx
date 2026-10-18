import Image from "next/image";
import { connection } from "next/server";
import { CalendarDays, Plus, MapPin, Wifi, Star } from "lucide-react";
import { sql } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, DataTable, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteEvent, duplicateEvent } from "./actions";

type Row = { id: string; slug: string; title: string; start_at: string; end_at: string | null; all_day: boolean; venue: string; is_online: boolean; image_url: string | null; status: string; is_featured: boolean; categories: string[] | null };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EventsPage({ searchParams }: PageProps<"/admin/events">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status) || "upcoming";
  const page = clampPage(sp.page);
  const scope = status === "past" ? sql`and e.status <> 'draft' and coalesce(e.end_at, e.start_at) < now()` : status === "drafts" ? sql`and e.status = 'draft'` : status === "all" ? sql`` : sql`and e.status <> 'draft' and coalesce(e.end_at, e.start_at) >= now()`;
  const where = sql`where true ${q ? sql`and (e.title ilike ${"%" + q + "%"} or e.venue ilike ${"%" + q + "%"} or e.slug ilike ${"%" + q + "%"})` : sql``} ${scope}`;
  const order = status === "past" ? sql`e.start_at desc` : status === "drafts" || status === "all" ? sql`e.updated_at desc` : sql`e.start_at asc`;
  const [rows, [{ count }], counts] = await Promise.all([
    sql<Row[]>`select e.id, e.slug, e.title, e.start_at::text, e.end_at::text, e.all_day, e.venue, e.is_online, e.image_url, e.status::text, e.is_featured,
        (select array_agg(c.name order by c.name) from public.event_categories c where c.id = any(e.category_ids)) as categories
      from public.events e ${where} order by ${order} limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.events e ${where}`,
    sql<{ upcoming: number; past: number; drafts: number }[]>`select
        (select count(*) from public.events where status <> 'draft' and coalesce(end_at, start_at) >= now())::int as upcoming,
        (select count(*) from public.events where status <> 'draft' and coalesce(end_at, start_at) < now())::int as past,
        (select count(*) from public.events where status = 'draft')::int as drafts`,
  ]);
  const c = counts[0];
  const tabs = [
    { label: "Upcoming", href: `/admin/events${qs({ q })}`, active: status === "upcoming", count: c.upcoming },
    { label: "Past", href: `/admin/events${qs({ q, status: "past" })}`, active: status === "past", count: c.past },
    { label: "Drafts", href: `/admin/events${qs({ q, status: "drafts" })}`, active: status === "drafts", count: c.drafts },
    { label: "All", href: `/admin/events${qs({ q, status: "all" })}`, active: status === "all" },
  ];
  return (
    <>
      <PageHeader title="Events" description="Workshops, webinars, open days and community events. Times are shown in Sri Lanka time (Asia/Colombo)." actions={<Button href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> New event</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search title, venue or slug…" tabs={tabs} hidden={{ status: status === "upcoming" ? "" : status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/events/${r.id}`}
          empty={<EmptyState icon={<CalendarDays className="h-6 w-6" />} title={q ? "No events match" : status === "drafts" ? "No draft events" : status === "past" ? "No past events" : "No upcoming events"} description={q ? "Try a different search." : "Create an event to list it on the website."} action={!q ? <Button href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> New event</Button> : undefined} />}
          columns={[
            { key: "title", header: "Event", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">{r.image_url ? <Image src={r.image_url} alt="" fill sizes="64px" className="object-cover" /> : <CalendarDays className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />}</span>
                <span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold text-slate-900">{r.title}{r.is_featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Featured" />}</span><span className="block truncate text-xs text-slate-500">{r.categories?.join(", ") || "Uncategorised"}</span></span>
              </span>
            ) },
            { key: "start_at", header: "When", render: (r) => <span className="text-slate-700">{r.all_day ? formatDate(r.start_at) : formatDateTime(r.start_at)}{r.end_at && <span className="block text-xs text-slate-500">to {r.all_day ? formatDate(r.end_at) : formatDateTime(r.end_at)}</span>}</span> },
            { key: "venue", header: "Where", hideBelow: "md", render: (r) => <span className="inline-flex items-center gap-1 text-slate-600">{r.is_online ? <><Wifi className="h-3.5 w-3.5 text-brand-600" /> Online</> : <><MapPin className="h-3.5 w-3.5 text-slate-400" /> {r.venue || "—"}</>}</span> },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-36", render: (r) => <RowActions id={r.id} editHref={`/admin/events/${r.id}`} viewHref={r.status === "published" ? `/events/${r.slug}` : undefined} onDuplicate={duplicateEvent} onDelete={deleteEvent} editBase="/admin/events" deleteMessage={`Delete event “${r.title}”?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/events${qs({ q, status: status === "upcoming" ? "" : status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
