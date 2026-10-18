"use client";

import { useActionState } from "react";
import { AField, AInput, ATextarea, ActionToast, SubmitButton, initialActionState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { saveFaqGroup } from "./actions";

export type FaqGroupRecord = { id: string; slug: string; title: string; description: string };

export function FaqGroupForm({ group }: { group: FaqGroupRecord | null }) {
  const [state, action] = useActionState(saveFaqGroup, initialActionState);
  const s = useSlugSync(group?.title || "", group?.slug || "", !group);
  const err = state?.errors || {};
  return (
    <form action={action} className="space-y-4">
      <ActionToast state={state} />
      {group && <input type="hidden" name="id" value={group.id} />}
      <AField label="Title" htmlFor="title" required error={err.title}><AInput id="title" name="title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} required placeholder="General questions" /></AField>
      <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} prefix="group:" hint="Referenced by FAQ blocks and programme pages." />
      <AField label="Description" htmlFor="description" error={err.description}><ATextarea id="description" name="description" rows={3} defaultValue={group?.description || ""} placeholder="Optional intro shown above the questions." /></AField>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {!group && <Button href="/admin/faqs" variant="ghost" size="sm">Cancel</Button>}
        <SubmitButton size="sm">{group ? "Save group" : "Create group"}</SubmitButton>
      </div>
    </form>
  );
}
