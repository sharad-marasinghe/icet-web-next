"use client";

import * as React from "react";
import { Link2, Lock, Unlock } from "lucide-react";
import { slugify } from "@/lib/utils";
import { AField, AInput } from "@/components/admin/ui";

/**
 * Keeps a title and slug in sync: while the slug has not been edited manually
 * (and `auto` is on) the slug follows the title. Event-driven, no effects.
 */
export function useSlugSync(initialTitle: string, initialSlug: string, auto: boolean) {
  const [title, setTitleState] = React.useState(initialTitle);
  const [slug, setSlugState] = React.useState(initialSlug);
  const [locked, setLocked] = React.useState(!auto || !!initialSlug);
  const setTitle = (v: string) => {
    setTitleState(v);
    if (!locked) setSlugState(slugify(v));
  };
  const setSlug = (v: string) => {
    setSlugState(v);
    setLocked(true);
  };
  const regenerate = () => {
    setSlugState(slugify(title));
    setLocked(false);
  };
  return { title, setTitle, slug, setSlug, locked, setLocked, regenerate };
}

export function SlugField({ value, onChange, locked, onToggleLock, prefix = "/", error, name = "slug", label = "Slug", hint, required = true }: { value: string; onChange: (v: string) => void; locked?: boolean; onToggleLock?: () => void; prefix?: string; error?: string; name?: string; label?: string; hint?: string; required?: boolean }) {
  return (
    <AField label={label} htmlFor={name} error={error} hint={hint ?? "Lower-case letters, numbers and hyphens."} required={required}>
      <div className="flex items-stretch">
        <span className="inline-flex items-center gap-1 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-2.5 text-xs font-medium text-slate-500"><Link2 className="h-3.5 w-3.5" />{prefix}</span>
        <AInput id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(slugify(e.target.value))} className="rounded-none font-mono text-[13px]" spellCheck={false} autoComplete="off" />
        {onToggleLock ? (
          <button type="button" onClick={onToggleLock} className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-300 bg-white px-2.5 text-slate-500 hover:text-brand-700" title={locked ? "Slug is fixed. Click to follow the title again." : "Slug follows the title. Click to fix it."} aria-pressed={locked}>
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="rounded-r-lg border border-l-0 border-slate-300 bg-white px-1" />
        )}
      </div>
    </AField>
  );
}
