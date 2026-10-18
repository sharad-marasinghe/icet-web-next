"use client";

import * as React from "react";
import { useActionState } from "react";
import { Save, Link2, ClipboardList } from "lucide-react";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, AInput, AField, SubmitButton, ActionToast, initialActionState, Toggle, StatusBadge } from "@/components/admin/ui";
import { RichText } from "@/components/admin/rich-text";
import type { Batch } from "@/lib/registry/service";
import type { EmailTemplate } from "@/lib/registry/fields";
import { saveBatch } from "@/app/admin/(dashboard)/registry/batches/actions";
import { FormBuilder } from "./form-builder";
import { EntityEmails } from "./entity-emails";
import { CopyButton } from "./copy-button";
import { toLocalInput } from "./shared";

export function BatchEditor({ batch, siteUrl, globalTemplates, applications }: { batch: Batch | null; siteUrl: string; globalTemplates: { reg: EmailTemplate; cert: EmailTemplate }; applications: number }) {
  const [state, action] = useActionState(saveBatch, initialActionState);
  const [name, setName] = React.useState(batch?.batch_name || "");
  const [slugInput, setSlugInput] = React.useState(batch?.slug || "");
  const [slugTouched, setSlugTouched] = React.useState(!!batch);
  const slug = slugTouched ? slugInput : slugify(name);
  const [intro, setIntro] = React.useState(batch?.intro_html || "");
  const [isOpen, setIsOpen] = React.useState(batch ? batch.is_open : true);
  const errors = state?.errors || {};
  const publicUrl = slug ? `${siteUrl}/academic-registration/${slug}` : "";

  return (
    <form action={action} className="space-y-6">
      <ActionToast state={state} />
      {batch && <input type="hidden" name="id" value={batch.id} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Batch details">
            <div className="grid gap-4 sm:grid-cols-2">
              <AField label="Batch name" required error={errors.batch_name}><AInput name="batch_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iCD 2026 September intake" required maxLength={200} /></AField>
              <AField label="Course code" error={errors.course_code} hint="Prefix for application references, e.g. ICD → ICD-A1B2C3"><AInput name="course_code" defaultValue={batch?.course_code || ""} placeholder="ICD" maxLength={40} className="font-mono uppercase" /></AField>
              <AField label="Slug" error={errors.slug} hint={publicUrl ? <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> {publicUrl}</span> : "Used in the public URL"}>
                <AInput name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlugInput(slugify(e.target.value)); }} />
              </AField>
              <AField label="Intro title" error={errors.intro_title} hint="Heading shown above the application form"><AInput name="intro_title" defaultValue={batch?.intro_title || ""} maxLength={200} /></AField>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-semibold text-slate-700">Intro text</p>
                <RichText value={intro} onChange={setIntro} name="intro_html" minHeight={140} placeholder="Entry requirements, documents to prepare, deadlines…" />
              </div>
            </div>
          </Panel>
          <Panel title="Availability">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><Toggle name="is_open" checked={isOpen} onChange={setIsOpen} label="Accepting applications" description="When off, the public form shows a closed notice regardless of the dates below." /></div>
              <AField label="Opens at" hint="Optional · Sri Lanka time" error={errors.opens_at}><AInput name="opens_at" type="datetime-local" defaultValue={toLocalInput(batch?.opens_at)} /></AField>
              <AField label="Closes at" hint="Optional · Sri Lanka time" error={errors.closes_at}><AInput name="closes_at" type="datetime-local" defaultValue={toLocalInput(batch?.closes_at)} /></AField>
            </div>
          </Panel>
          <Panel title="Application form" description="Supports file uploads, page breaks and filterable answers. Changing questions bumps the form version so older applications keep their original layout.">
            <FormBuilder name="form_fields" initial={batch?.form_fields || {}} allowFiles preview={{ mode: "batch", title: batch?.intro_title || name || "Application", description: intro }} />
          </Panel>
          <Panel title="Response email" description="Confirmation sent to applicants.">
            <EntityEmails name="email_settings" initial={batch?.email_settings || {}} defaults={globalTemplates} showCert={false} entityType="batch" entityId={batch?.id} />
          </Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Panel title={batch ? "Batch" : "New batch"}>
            <div className="space-y-3 text-sm">
              {batch && (
                <>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Applications</span><StatusBadge value={batch.is_open ? "active" : "closed"} /></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Received</span><span className="font-semibold text-slate-900">{applications}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Form version</span><span className="font-mono text-xs text-slate-700">v{batch.form_version}</span></div>
                </>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <SubmitButton className="w-full"><Save className="h-4 w-4" /> {batch ? "Save changes" : "Create batch"}</SubmitButton>
                {batch && <Button href={`/admin/registry/applications?batch_id=${batch.id}`} variant="outline" size="md"><ClipboardList className="h-4 w-4" /> Review applications</Button>}
              </div>
            </div>
          </Panel>
          <Panel title="Public URL">
            <p className="text-xs text-slate-600">The application form is served at:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{publicUrl || `${siteUrl}/academic-registration/<slug>`}</code>
              {publicUrl && <CopyButton value={publicUrl} />}
            </div>
            <p className="mt-3 text-xs text-slate-500">You can also embed this form on any page with a <strong>Form</strong> block (kind: academic batch) in the page editor.</p>
          </Panel>
        </aside>
      </div>
    </form>
  );
}
