import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AdminShell } from "@/components/admin/shell";

// The admin is fully request-time; opt out of instant-navigation validation for this segment.
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ children }: { children: React.ReactNode }) {
  await connection(); // admin is always rendered at request time (session + live data)
  const user = await requireUser("viewer");
  const [counts] = await sql<{ inquiries: number; applications: number }[]>`
    select (select count(*) from public.inquiries where status = 'new')::int as inquiries,
           (select count(*) from public.reg_applications where status = 'submitted')::int as applications`;
  return <AdminShell user={user} counts={{ ...counts }}>{children}</AdminShell>;
}
