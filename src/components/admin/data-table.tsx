import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "./ui";

/**
 * Server-compatible table: deliberately has no "use client" directive so server pages can pass
 * `render` functions and `onRowHref` (functions cannot cross the server→client boundary).
 * It also works when imported from client components.
 */
export type Column<T> = { key: string; header: React.ReactNode; render?: (row: T) => React.ReactNode; className?: string; hideBelow?: "sm" | "md" | "lg" };
export function DataTable<T extends { id: string | number }>({ rows, columns, empty, onRowHref, dense }: { rows: T[]; columns: Column<T>[]; empty?: React.ReactNode; onRowHref?: (row: T) => string; dense?: boolean }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className={cn("px-4 py-3", c.className, c.hideBelow && hide[c.hideBelow])}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((r) => (
            <tr key={r.id} className={cn("hover:bg-brand-50/40", onRowHref && "cursor-pointer")}>
              {columns.map((c) => (
                <td key={c.key} className={cn("align-middle", dense ? "px-4 py-2" : "px-4 py-3", c.className, c.hideBelow && hide[c.hideBelow])}>
                  {onRowHref && c.key === columns[0].key ? <Link href={onRowHref(r)} className="block">{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}</Link> : c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

