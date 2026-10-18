import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ProfileForm, PasswordForm } from "@/components/admin/system/profile-forms";

export const metadata: Metadata = { title: "My profile" };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function ProfilePage() {
  await connection();
  const user = await requireUser("viewer");
  const [meta] = await sql<{ last_login_at: string | null; created_at: string }[]>`select last_login_at::text, created_at::text from public.profiles where id = ${user.id}`;
  return (
    <>
      <PageHeader title="My profile" description="Your name and photo appear in the admin and on the posts you author." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "My profile" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Details"><ProfileForm initial={{ full_name: user.full_name, avatar_url: user.avatar_url || "" }} /></Panel>
          <Panel title="Change password" description="You will stay signed in on this device."><PasswordForm /></Panel>
        </div>
        <Panel title="Account">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</dt><dd className="mt-0.5 font-medium text-slate-900">{user.email}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</dt><dd className="mt-1"><StatusBadge value={user.role} map={{ super_admin: "rose", admin: "brand", editor: "green", viewer: "slate" }} /></dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Last sign-in</dt><dd className="mt-0.5 text-slate-700">{meta?.last_login_at ? formatDateTime(meta.last_login_at) : "—"}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Member since</dt><dd className="mt-0.5 text-slate-700">{meta ? formatDateTime(meta.created_at) : "—"}</dd></div>
          </dl>
          <p className="mt-5 text-xs text-slate-500">To change your email or role, ask a super admin.</p>
        </Panel>
      </div>
    </>
  );
}
