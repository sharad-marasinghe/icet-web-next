import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { UsersTable, type ProfileRow } from "@/components/admin/system/users-table";

export const metadata: Metadata = { title: "Users & roles" };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function UsersPage() {
  await connection();
  const me = await requireUser("admin");
  const rows = await sql<ProfileRow[]>`select id, email, full_name, role, is_active, avatar_url, last_login_at::text, created_at::text from public.profiles order by is_active desc, role, full_name, email`;
  const active = rows.filter((r) => r.is_active).length;
  return (
    <>
      <PageHeader title="Users & roles" description={`${active} active staff account${active === 1 ? "" : "s"}. Super admins manage everything; admins manage content and settings; editors edit content; viewers can only read.`} breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users & roles" }]} />
      <Panel padded={false}>
        <div className="p-5"><UsersTable rows={rows.map((r) => ({ ...r }))} me={{ id: me.id, role: me.role }} /></div>
      </Panel>
    </>
  );
}
