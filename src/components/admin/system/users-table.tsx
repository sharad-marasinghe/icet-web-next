"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserPlus, KeyRound, Pencil, Trash2, Wand2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import type { AdminRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { AField, AInput, ASelect, Toggle, SubmitButton, ActionToast, initialActionState, Modal, useToast, StatusBadge } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { CopyButton, generatePassword } from "./helpers";
import { createUser, updateUser, setUserPassword, deleteUser } from "@/app/admin/(dashboard)/users/actions";

export type ProfileRow = { id: string; email: string; full_name: string; role: AdminRole; is_active: boolean; avatar_url: string | null; last_login_at: string | null; created_at: string };
const RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, admin: 2, super_admin: 3 };
const ROLE_LABEL: Record<AdminRole, string> = { super_admin: "Super admin", admin: "Admin", editor: "Editor", viewer: "Viewer" };
const ROLE_TONE: Record<string, string> = { super_admin: "rose", admin: "brand", editor: "green", viewer: "slate" };

function PasswordInput({ name, error, label = "Password" }: { name: string; error?: string; label?: string }) {
  const [value, setValue] = React.useState("");
  const [show, setShow] = React.useState(true);
  return (
    <AField label={label} htmlFor={name} error={error} hint="At least 10 characters with letters and numbers. Share it securely — it is not emailed.">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <AInput id={name} name={name} type={show ? "text" : "password"} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" required className="pr-10 font-mono" />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100" aria-label={show ? "Hide" : "Show"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => { setValue(generatePassword()); setShow(true); }}><Wand2 className="h-4 w-4" /> Generate</Button>
        <CopyButton text={value} className="h-10 w-10 rounded-lg border border-slate-300" />
      </div>
    </AField>
  );
}

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action] = useActionState(createUser, initialActionState);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  return (
    <Modal open={open} onClose={onClose} title="Add staff user">
      <ActionToast state={state} />
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AField label="Full name" htmlFor="cu-name" required error={state?.errors?.full_name}><AInput id="cu-name" name="full_name" required autoComplete="off" /></AField>
          <AField label="Email" htmlFor="cu-email" required error={state?.errors?.email}><AInput id="cu-email" name="email" type="email" required autoComplete="off" /></AField>
        </div>
        <AField label="Role" htmlFor="cu-role" error={state?.errors?.role}>
          <ASelect id="cu-role" name="role" defaultValue="editor">
            <option value="viewer">Viewer — read-only access</option>
            <option value="editor">Editor — edit content, inquiries and registry</option>
            <option value="admin">Admin — plus settings, navigation, users</option>
            <option value="super_admin">Super admin — full control incl. roles</option>
          </ASelect>
        </AField>
        <PasswordInput name="password" label="Temporary password" error={state?.errors?.password} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm" pendingText="Creating…"><UserPlus className="h-4 w-4" /> Create user</SubmitButton></div>
      </form>
    </Modal>
  );
}

function EditModal({ row, me, onClose }: { row: ProfileRow | null; me: { id: string; role: AdminRole }; onClose: () => void }) {
  return (
    <Modal open={!!row} onClose={onClose} title="Edit user">
      {row && <EditForm key={row.id} row={row} me={me} onClose={onClose} />}
    </Modal>
  );
}

function EditForm({ row, me, onClose }: { row: ProfileRow; me: { id: string; role: AdminRole }; onClose: () => void }) {
  const [state, action] = useActionState(updateUser, initialActionState);
  const [active, setActive] = React.useState(row.is_active);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  const isSelf = row.id === me.id;
  const canRole = me.role === "super_admin";
  return (
    <>
      <ActionToast state={state} />
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="is_active" value={active ? "on" : "off"} />
          <AField label="Email"><AInput value={row.email} disabled /></AField>
          <AField label="Full name" htmlFor="eu-name" required error={state?.errors?.full_name}><AInput id="eu-name" name="full_name" defaultValue={row.full_name} required /></AField>
          <AField label="Role" htmlFor="eu-role" error={state?.errors?.role} hint={!canRole ? "Only a super admin can change roles." : isSelf ? "You cannot lower your own role." : undefined}>
            <ASelect id="eu-role" name="role" defaultValue={row.role} disabled={!canRole}>
              {(["viewer", "editor", "admin", "super_admin"] as AdminRole[]).map((r) => <option key={r} value={r} disabled={isSelf && RANK[r] < RANK[me.role]}>{ROLE_LABEL[r]}</option>)}
            </ASelect>
            {!canRole && <input type="hidden" name="role" value={row.role} />}
          </AField>
          {!isSelf ? <Toggle checked={active} onChange={setActive} label="Account active" description="Inactive users cannot sign in or use the admin." /> : <p className="text-xs text-slate-500">You cannot deactivate your own account.</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm">Save changes</SubmitButton></div>
        </form>
    </>
  );
}

function PasswordModal({ row, onClose }: { row: ProfileRow | null; onClose: () => void }) {
  const [state, action] = useActionState(setUserPassword, initialActionState);
  React.useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  return (
    <Modal open={!!row} onClose={onClose} title={`Set password · ${row?.email ?? ""}`}>
      <ActionToast state={state} />
      {row && (
        <form action={action} key={row.id} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <PasswordInput name="password" label="New password" error={state?.errors?.password} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm" pendingText="Updating…"><KeyRound className="h-4 w-4" /> Set password</SubmitButton></div>
        </form>
      )}
    </Modal>
  );
}

export function UsersTable({ rows, me }: { rows: ProfileRow[]; me: { id: string; role: AdminRole } }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ProfileRow | null>(null);
  const [pw, setPw] = React.useState<ProfileRow | null>(null);
  const toast = useToast();
  const router = useRouter();
  const isSuper = me.role === "super_admin";
  const closeCreate = React.useCallback(() => setCreating(false), []);
  const closeEdit = React.useCallback(() => setEditing(null), []);
  const closePw = React.useCallback(() => setPw(null), []);
  const canTouch = (r: ProfileRow) => r.id === me.id || RANK[r.role] <= RANK[me.role];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-brand-600" /> {isSuper ? "You can create users, change roles and remove accounts." : "Admins can edit names, set passwords and deactivate lower-role accounts."}</p>
        {isSuper && <Button type="button" size="sm" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Add user</Button>}
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "full_name", header: "Name", render: (r) => (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-600 text-sm font-bold text-white">{r.avatar_url ? <Image src={r.avatar_url} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" /> : (r.full_name || r.email).charAt(0).toUpperCase()}</span>
              <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{r.full_name || "—"}{r.id === me.id && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">YOU</span>}</p><p className="truncate text-xs text-slate-500">{r.email}</p></div>
            </div>
          ) },
          { key: "role", header: "Role", render: (r) => <StatusBadge value={r.role} map={ROLE_TONE} /> },
          { key: "is_active", header: "Status", hideBelow: "sm", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
          { key: "last_login_at", header: "Last login", hideBelow: "md", render: (r) => <span className="text-slate-600">{r.last_login_at ? formatDateTime(r.last_login_at) : "Never"}</span> },
          { key: "created_at", header: "Created", hideBelow: "lg", render: (r) => <span className="text-slate-600">{formatDateTime(r.created_at)}</span> },
          { key: "actions", header: "", className: "text-right", render: (r) => canTouch(r) ? (
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => setEditing(r)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Edit" title="Edit"><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => setPw(r)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Set password" title="Set password"><KeyRound className="h-4 w-4" /></button>
              {isSuper && r.id !== me.id && (
                <button type="button" onClick={async () => { if (!confirm(`Remove ${r.email}? They will lose access immediately. This cannot be undone.`)) return; const res = await deleteUser(r.id); toast({ tone: res?.ok ? "success" : "error", message: res?.message || "" }); if (res?.ok) router.refresh(); }} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete" title="Delete"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ) : <span className="text-xs text-slate-400">—</span> },
        ]}
      />
      <CreateModal open={creating} onClose={closeCreate} />
      <EditModal row={editing} me={me} onClose={closeEdit} />
      <PasswordModal row={pw} onClose={closePw} />
    </div>
  );
}
