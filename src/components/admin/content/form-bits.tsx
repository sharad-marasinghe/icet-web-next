"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import type { ActionState } from "@/components/admin/ui";
import { SubmitButton, ActionToast } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Warn before leaving the page while there are unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/**
 * Tracks whether a form has been edited since its last successful save.
 * Call `touch()` from change handlers; dirtiness resets automatically when
 * `state` changes to a successful result.
 */
export function useDirty(state: ActionState) {
  const [edits, setEdits] = React.useState(0);
  const [savedAt, setSavedAt] = React.useState<{ state: ActionState; edits: number }>({ state: null, edits: 0 });
  if (state && state.ok && savedAt.state !== state) {
    // state changed to a new successful save → everything up to now is saved (adjusting state during render is allowed by React)
    setSavedAt({ state, edits });
  }
  const dirty = edits > savedAt.edits;
  useUnsavedWarning(dirty);
  return { dirty, touch: () => setEdits((n) => n + 1) };
}

/** Sticky top bar for editors: back link, title, dirty indicator and primary actions. */
export function EditorBar({ backHref, backLabel, title, subtitle, dirty, state, viewHref, children, pendingText = "Saving…", saveLabel = "Save changes" }: { backHref: string; backLabel: string; title: React.ReactNode; subtitle?: React.ReactNode; dirty?: boolean; state: ActionState; viewHref?: string | null; children?: React.ReactNode; pendingText?: string; saveLabel?: string }) {
  return (
    <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ActionToast state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{backLabel}</span></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {dirty && <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes</span>}
        {children}
        {viewHref && <Button href={viewHref} external variant="outline" size="sm"><Eye className="h-4 w-4" /> View</Button>}
        <SubmitButton size="sm" pendingText={pendingText}>{saveLabel}</SubmitButton>
      </div>
    </div>
  );
}

/** Two-column editor grid: main column + sidebar. */
export function EditorGrid({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-6", aside ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "", className)}>
      <div className="min-w-0 space-y-6">{children}</div>
      {aside && <div className="space-y-6">{aside}</div>}
    </div>
  );
}

/** Small helper for a labelled group of fields on a sidebar panel. */
export function FieldGroup({ children, className, cols = 1 }: { children: React.ReactNode; className?: string; cols?: 1 | 2 | 3 }) {
  return <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", className)}>{children}</div>;
}
