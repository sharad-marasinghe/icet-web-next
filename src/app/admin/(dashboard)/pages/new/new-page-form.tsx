"use client";

import { useActionState } from "react";
import { AField, AInput, ASelect, ActionToast, SubmitButton, initialActionState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { createPage } from "../actions";

export function NewPageForm() {
  const [state, action] = useActionState(createPage, initialActionState);
  const s = useSlugSync("", "", true);
  return (
    <form action={action} className="space-y-5">
      <ActionToast state={state} />
      <AField label="Title" htmlFor="title" required error={state?.errors?.title}>
        <AInput id="title" name="title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} placeholder="e.g. About iCET" autoFocus required />
      </AField>
      <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={state?.errors?.slug} hint="Public URL: icet.lk/<slug>. Use “home” for the home page." />
      <AField label="Template" htmlFor="template" hint="Blocks is the standard page builder.">
        <ASelect id="template" name="template" defaultValue="blocks">
          <option value="blocks">Blocks (page builder)</option>
          <option value="custom">Custom (developer-defined)</option>
        </ASelect>
      </AField>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Button href="/admin/pages" variant="ghost" size="sm">Cancel</Button>
        <SubmitButton size="sm" pendingText="Creating…">Create & edit content</SubmitButton>
      </div>
    </form>
  );
}
