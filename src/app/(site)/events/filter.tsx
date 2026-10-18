import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/lib/data/content";

export function EventsFilter({ categories, active, view, counts }: { categories: EventCategory[]; active?: string; view: "upcoming" | "past"; counts: { upcoming: number; past: number } }) {
  const href = (v: string, c?: string) => `/events?view=${v}${c ? `&category=${c}` : ""}`;
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="inline-flex rounded-full bg-slate-100 p-1">
        {(["upcoming", "past"] as const).map((v) => (
          <Link key={v} href={href(v, active)} className={cn("rounded-full px-5 py-2 text-sm font-semibold capitalize transition", view === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
            {v} <span className="ml-1 text-xs text-slate-400">({counts[v]})</span>
          </Link>
        ))}
      </div>
      <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        <Link href={href(view)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", !active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-brand-300")}>All</Link>
        {categories.map((c) => (
          <Link key={c.id} href={href(view, c.slug)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", active === c.slug ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-brand-300")}>{c.name}</Link>
        ))}
      </div>
    </div>
  );
}
