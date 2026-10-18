import Link from "next/link";
import { SearchBox } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/** Server-renderable list toolbar: search form (GET) plus optional status tabs rendered as links. */
export function ListToolbar({ q, placeholder, tabs, hidden = {}, children }: { q?: string; placeholder?: string; tabs?: { label: string; href: string; active: boolean; count?: number }[]; hidden?: Record<string, string>; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {tabs ? (
        <nav className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" aria-label="Filter">
          {tabs.map((t) => (
            <Link key={t.label} href={t.href} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition", t.active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")} aria-current={t.active ? "page" : undefined}>
              {t.label}{typeof t.count === "number" && <span className={cn("rounded-full px-1.5 text-[11px]", t.active ? "bg-brand-50 text-brand-700" : "bg-slate-200 text-slate-600")}>{t.count}</span>}
            </Link>
          ))}
        </nav>
      ) : <span />}
      <form className="flex items-center gap-2" role="search">
        {Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
        {children}
        <SearchBox defaultValue={q} placeholder={placeholder} />
      </form>
    </div>
  );
}

/** Builds a query string from a record, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
