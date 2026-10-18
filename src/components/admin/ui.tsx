"use client";

import * as React from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2, Check, X, AlertTriangle, Info, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

/* ───────────── Toasts ───────────── */
type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
const ToastCtx = React.createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cn("pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-elev animate-fade-up", t.tone === "success" ? "bg-green-600" : t.tone === "error" ? "bg-rose-600" : "bg-slate-800")} style={{ animationDuration: ".3s" }}>
            {t.tone === "success" ? <Check className="mt-0.5 h-4 w-4" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <Info className="mt-0.5 h-4 w-4" />}
            <span>{t.message}</span>
            <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-2 opacity-70 hover:opacity-100" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = React.useContext(ToastCtx);
  return ctx?.push ?? (() => {});
}

/* ───────────── Action state helpers ───────────── */
export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string>; id?: string | number } | null;
export const initialActionState: ActionState = null;

export function SubmitButton({ children, pendingText = "Saving…", ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> {pendingText}</> : children}
    </Button>
  );
}

/** Shows the result of a server action as a toast whenever it changes. */
export function ActionToast({ state }: { state: ActionState }) {
  const toast = useToast();
  const last = React.useRef<ActionState>(null);
  React.useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      if (state.message) toast({ tone: state.ok ? "success" : "error", message: state.message });
    }
  }, [state, toast]);
  return null;
}

export function FieldError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null;
}

/* ───────────── Page scaffolding ───────────── */
export function PageHeader({ title, description, actions, breadcrumbs }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {breadcrumbs && (
          <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {b.href ? <Link href={b.href} className="hover:text-brand-700">{b.label}</Link> : <span className="text-slate-700">{b.label}</span>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, children, className, actions, padded = true }: { title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="font-display text-[15px] font-bold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon, tone = "brand", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "brand" | "green" | "amber" | "rose" | "slate"; href?: string }) {
  const t = { brand: "bg-brand-50 text-brand-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", slate: "bg-slate-100 text-slate-600" }[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <span className={cn("grid h-9 w-9 place-items-center rounded-lg", t)}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-card";
  return href ? <Link href={href} className={cn(cls, "block")}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      {icon && <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">{icon}</div>}
      <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** `baseHref` is a URL template containing `{page}` (or `__PAGE__`), so server components can pass it to this client component. */
export function Pagination({ page, pages, baseHref }: { page: number; pages: number; baseHref: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => baseHref.replace(/\{page\}|%7Bpage%7D|__PAGE__/g, String(p));
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-slate-500">Page {page} of {pages}</span>
      <div className="flex gap-2">
        <Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn("inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold", page <= 1 ? "pointer-events-none opacity-40" : "hover:border-brand-300")}><ChevronLeft className="h-4 w-4" /> Prev</Link>
        <Link href={href(Math.min(pages, page + 1))} aria-disabled={page >= pages} className={cn("inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold", page >= pages ? "pointer-events-none opacity-40" : "hover:border-brand-300")}>Next <ChevronRight className="h-4 w-4" /></Link>
      </div>
    </nav>
  );
}

export function SearchBox({ defaultValue, placeholder = "Search…", name = "q" }: { defaultValue?: string; placeholder?: string; name?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:w-64" />
    </div>
  );
}

export function StatusBadge({ value, map }: { value: string; map?: Record<string, string> }) {
  const tone = (map || {})[value] || ({ published: "green", active: "green", valid: "green", accepted: "green", sent: "green", new: "brand", submitted: "brand", under_review: "amber", shortlisted: "amber", draft: "slate", completed: "slate", archived: "slate", closed: "slate", contacted: "amber", qualified: "amber", converted: "green", rejected: "rose", withdrawn: "rose", revoked: "rose", failed: "rose", spam: "rose", suspended: "rose", inactive: "slate" } as Record<string, string>)[value] || "slate";
  const cls = { green: "bg-green-50 text-green-700 ring-green-200", brand: "bg-brand-50 text-brand-700 ring-brand-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", slate: "bg-slate-100 text-slate-700 ring-slate-200", rose: "bg-rose-50 text-rose-700 ring-rose-200" }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset", cls)}>{value.replace(/_/g, " ")}</span>;
}

/* ───────────── Form controls (admin density) ───────────── */
const inputCls = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50";
export const AInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function AInput({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...p} />;
});
export const ATextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function ATextarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputCls, "h-auto min-h-[90px] py-2", className)} {...p} />;
});
export const ASelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function ASelect({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn(inputCls, className)} {...p}>{children}</select>;
});
export function AField({ label, htmlFor, hint, error, children, className, required }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-0.5 text-rose-600">*</span>}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}
export function Toggle({ checked, onChange, label, name, description }: { checked: boolean; onChange?: (v: boolean) => void; label?: React.ReactNode; name?: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" name={name} className="peer sr-only" checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      {(label || description) && (
        <span className="text-sm">
          {label && <span className="font-semibold text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function ConfirmButton({ onConfirm, children, message = "Are you sure? This cannot be undone.", variant = "danger", size = "sm", className }: { onConfirm: () => void | Promise<void>; children: React.ReactNode; message?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button type="button" variant={variant} size={size} className={className} loading={busy} onClick={async () => { if (!confirm(message)) return; setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
      {children}
    </Button>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={cn("flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-elev sm:rounded-2xl animate-fade-up", wide ? "sm:max-w-5xl" : "sm:max-w-2xl")} style={{ animationDuration: ".25s" }} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: React.ReactNode; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="scrollbar-none -mb-px flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition", active === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
          {t.label}{typeof t.count === "number" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
