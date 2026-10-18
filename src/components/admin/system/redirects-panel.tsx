"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Pencil, Trash2, ArrowRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { AField, AInput, ASelect, ATextarea, Toggle, SubmitButton, ActionToast, initialActionState, Modal, useToast, StatusBadge, EmptyState, type ActionState } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { addRedirect, updateRedirect, toggleRedirect, deleteRedirect, importRedirects } from "@/app/admin/(dashboard)/redirects/actions";

export type RedirectRow = { id: number; from_path: string; to_path: string; status_code: number; is_active: boolean; hits: number; created_at: string };

function RedirectFields({ row, errors }: { row?: RedirectRow; errors: Record<string, string> }) {
  const [active, setActive] = React.useState(row?.is_active ?? true);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_120px_auto] md:items-start">
      <AField label="From path" error={errors.from_path}><AInput name="from_path" defaultValue={row?.from_path} placeholder="/old-page" required className="font-mono text-xs" /></AField>
      <ArrowRight className="hidden h-4 w-4 self-center text-slate-400 md:mt-8 md:block" />
      <AField label="To (path or URL)" error={errors.to_path}><AInput name="to_path" defaultValue={row?.to_path} placeholder="/new-page or https://…" required className="font-mono text-xs" /></AField>
      <AField label="Status" error={errors.status_code}><ASelect name="status_code" defaultValue={String(row?.status_code ?? 301)}><option value="301">301 permanent</option><option value="302">302 temporary</option></ASelect></AField>
      <div className="md:pt-8">
        <input type="hidden" name="is_active" value={active ? "on" : "off"} />
        <Toggle checked={active} onChange={setActive} label="Active" />
      </div>
    </div>
  );
}

function AddForm() {
  const [state, action] = useActionState(addRedirect, initialActionState);
  const ref = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { ref.current?.reset(); router.refresh(); } }, [state, router]);
  return (
    <form ref={ref} action={action} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <ActionToast state={state} />
      <RedirectFields errors={state?.errors || {}} />
      <div className="mt-3 flex justify-end"><SubmitButton size="sm" pendingText="Adding…"><Plus className="h-4 w-4" /> Add redirect</SubmitButton></div>
    </form>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(importRedirects, initialActionState);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { router.refresh(); onDone(); } }, [state, router, onDone]);
  return (
    <form action={action} className="space-y-3">
      <ActionToast state={state} />
      <AField label="One redirect per line" hint="Format: /old-path, /new-path[, 301|302]. Lines starting with # are ignored." error={state?.errors?.lines}>
        <ATextarea name="lines" rows={10} className="font-mono text-xs" placeholder={"/old-course, /icet-certified-developer\n/promo, https://example.com/landing, 302"} required />
      </AField>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="overwrite" className="h-4 w-4 rounded border-slate-300" /> Overwrite redirects that already exist for the same source path</label>
      <div className="flex justify-end"><SubmitButton size="sm" pendingText="Importing…"><Upload className="h-4 w-4" /> Import</SubmitButton></div>
    </form>
  );
}

function EditModal({ row, onClose }: { row: RedirectRow | null; onClose: () => void }) {
  const [state, action] = useActionState(updateRedirect, initialActionState);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  return (
    <Modal open={!!row} onClose={onClose} title="Edit redirect" wide>
      <ActionToast state={state} />
      {row && (
        <form action={action} key={row.id} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <RedirectFields row={row} errors={state?.errors || {}} />
          <p className="text-xs text-slate-500">{row.hits.toLocaleString()} hit{row.hits === 1 ? "" : "s"} since {formatDate(row.created_at)}.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm">Save changes</SubmitButton></div>
        </form>
      )}
    </Modal>
  );
}

export function RedirectsPanel({ rows }: { rows: RedirectRow[] }) {
  const [showImport, setShowImport] = React.useState(false);
  const [editing, setEditing] = React.useState<RedirectRow | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const toast = useToast();
  const router = useRouter();
  const run = async (id: number, fn: () => Promise<ActionState>) => {
    setBusy(id);
    try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "" }); if (r?.ok) router.refresh(); } finally { setBusy(null); }
  };
  const closeImport = React.useCallback(() => setShowImport(false), []);
  const closeEdit = React.useCallback(() => setEditing(null), []);
  return (
    <div className="space-y-4">
      <AddForm />
      <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Bulk import</Button></div>
      <DataTable
        rows={rows}
        empty={<EmptyState title="No redirects yet" description="Add one above or import a list from your old sitemap." />}
        columns={[
          { key: "from_path", header: "From", render: (r) => <span className={cn("font-mono text-xs", !r.is_active && "text-slate-400 line-through")}>{r.from_path}</span> },
          { key: "to_path", header: "To", render: (r) => <span className="block max-w-[320px] truncate font-mono text-xs text-slate-600" title={r.to_path}>{r.to_path}</span> },
          { key: "status_code", header: "Status", hideBelow: "sm", render: (r) => <StatusBadge value={String(r.status_code)} map={{ "301": "slate", "302": "amber" }} /> },
          { key: "hits", header: "Hits", hideBelow: "md", className: "text-right", render: (r) => <span className="tabular-nums text-slate-600">{r.hits.toLocaleString()}</span> },
          { key: "is_active", header: "Active", hideBelow: "sm", render: (r) => <Toggle checked={r.is_active} onChange={(v) => run(r.id, () => toggleRedirect(r.id, v))} /> },
          { key: "actions", header: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => setEditing(r)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button type="button" disabled={busy === r.id} onClick={() => { if (confirm(`Delete the redirect from ${r.from_path}?`)) run(r.id, () => deleteRedirect(r.id)); }} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) },
        ]}
      />
      <Modal open={showImport} onClose={closeImport} title="Bulk import redirects"><ImportForm onDone={closeImport} /></Modal>
      <EditModal row={editing} onClose={closeEdit} />
    </div>
  );
}
