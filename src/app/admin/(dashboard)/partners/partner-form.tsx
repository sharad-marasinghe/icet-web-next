"use client";

import * as React from "react";
import { useActionState } from "react";
import { AField, AInput, Toggle, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { savePartner } from "./actions";

export type PartnerRecord = { id: string; name: string; logo_url: string; website_url: string | null; category: string; is_active: boolean; sort_order: number };
const DEFAULT_CATEGORIES = ["industry", "training", "academic"];

export function PartnerForm({ item, categories }: { item: PartnerRecord | null; categories: string[] }) {
  const [state, action] = useActionState(savePartner, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !item;
  const [name, setName] = React.useState(item?.name || "");
  const [logo, setLogo] = React.useState(item?.logo_url || "");
  const [active, setActive] = React.useState(item?.is_active ?? true);
  const suggestions = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories]));
  const err = state?.errors || {};
  return (
    <form action={action} onChange={touch}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="logo_url" value={logo} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <EditorBar backHref="/admin/partners" backLabel="Partners" title={isNew ? "New partner" : name || "Partner"} dirty={dirty} state={state} saveLabel={isNew ? "Create partner" : "Save changes"} />
      <EditorGrid aside={
        <Panel title="Display">
          <div className="space-y-4">
            <Toggle checked={active} onChange={(v) => { setActive(v); touch(); }} label="Active" description="Inactive partners are hidden from the website." />
            <AField label="Sort order" htmlFor="sort_order" error={err.sort_order}><AInput id="sort_order" name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} /></AField>
          </div>
        </Panel>
      }>
        <Panel title="Partner">
          <FieldGroup>
            <FieldGroup cols={2}>
              <AField label="Name" htmlFor="name" required error={err.name}><AInput id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Virtusa" /></AField>
              <AField label="Category" htmlFor="category" required error={err.category} hint="industry, training or academic – or type a new one.">
                <AInput id="category" name="category" list="partner-categories" defaultValue={item?.category || "industry"} required className="lowercase" />
                <datalist id="partner-categories">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
              </AField>
            </FieldGroup>
            <AField label="Website URL" htmlFor="website_url" error={err.website_url}><AInput id="website_url" name="website_url" type="url" defaultValue={item?.website_url || ""} placeholder="https://www.example.com" /></AField>
            <div>
              <ImageField label="Logo" value={logo} onChange={(v) => { setLogo(v); touch(); }} hint="Transparent PNG or SVG, roughly 3:1, at least 300px wide." />
              {err.logo_url && <p className="mt-1 text-xs font-medium text-rose-600">{err.logo_url}</p>}
            </div>
          </FieldGroup>
        </Panel>
      </EditorGrid>
    </form>
  );
}
