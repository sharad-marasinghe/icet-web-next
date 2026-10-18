"use client";

import * as React from "react";
import { useActionState } from "react";
import { Save, Link2, Eye } from "lucide-react";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, AInput, ASelect, AField, SubmitButton, ActionToast, initialActionState, StatusBadge } from "@/components/admin/ui";
import { RichText } from "@/components/admin/rich-text";
import { ImageField } from "@/components/admin/media-picker";
import type { Workshop } from "@/lib/registry/service";
import { defaultCampaign, type EmailTemplate } from "@/lib/registry/fields";
import { saveWorkshop, sendTestCertificateEmail } from "@/app/admin/(dashboard)/registry/workshops/actions";
import { FormBuilder } from "./form-builder";
import { EntityEmails } from "./entity-emails";
import { CertificateMapper } from "./certificate-mapper";
import { TrackingLinks, SourceAnalytics, type SourceCount } from "./tracking-links";
import { IssueCertificatesButton } from "./issue-certificates";
import { CopyButton } from "./copy-button";
import { toLocalInput } from "./shared";

export type WorkshopEditorProps = {
  workshop: Workshop | null;
  siteUrl: string;
  globalTemplates: { reg: EmailTemplate; cert: EmailTemplate };
  sources: SourceCount[];
  registrations: number;
};

export function WorkshopEditor({ workshop, siteUrl, globalTemplates, sources, registrations }: WorkshopEditorProps) {
  const [state, action] = useActionState(saveWorkshop, initialActionState);
  const [title, setTitle] = React.useState(workshop?.title || "");
  const [slugInput, setSlugInput] = React.useState(workshop?.slug || "");
  const [slugTouched, setSlugTouched] = React.useState(!!workshop);
  const slug = slugTouched ? slugInput : slugify(title);
  const [description, setDescription] = React.useState(workshop?.description || "");
  const [hero, setHero] = React.useState(workshop?.hero_image || "");
  const [regUrlInput, setRegUrlInput] = React.useState(workshop?.registration_page_url || "");
  const [regUrlTouched, setRegUrlTouched] = React.useState(!!workshop?.registration_page_url);
  const regUrl = regUrlTouched ? regUrlInput : slug ? `${siteUrl}/register/${slug}` : "";
  const [campaignInput, setCampaignInput] = React.useState(workshop?.registration_campaign || "");
  const [campaignTouched, setCampaignTouched] = React.useState(!!workshop?.registration_campaign);
  const campaign = campaignTouched ? campaignInput : defaultCampaign(title, workshop?.id || 0);
  const [prefix, setPrefix] = React.useState(workshop?.cert_id_prefix || "");
  const errors = state?.errors || {};


  const codeExample = `${prefix ? prefix.toUpperCase() : `ICET-WS${workshop?.id || "N"}`}-XXXXXXXX`;
  const publicUrl = slug ? `${siteUrl}/register/${slug}` : "";

  return (
    <form action={action} className="space-y-6">
      <ActionToast state={state} />
      {workshop && <input type="hidden" name="id" value={workshop.id} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <AField label="Title" required error={errors.title} className="sm:col-span-2">
                <AInput name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to DevOps Workshop" maxLength={200} required />
              </AField>
              <AField label="Slug" hint={publicUrl ? <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> {publicUrl}</span> : "Used in the public registration URL"} error={errors.slug}>
                <AInput name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlugInput(slugify(e.target.value)); }} />
              </AField>
              <AField label="Status" error={errors.status}>
                <ASelect name="status" defaultValue={workshop?.status || "draft"}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="active">Active (registrations open)</option>
                  <option value="completed">Completed (closed)</option>
                </ASelect>
              </AField>
              <AField label="Seats" hint="Leave blank for unlimited" error={errors.seats}>
                <AInput name="seats" type="number" min={0} defaultValue={workshop?.seats ?? ""} />
              </AField>
              <AField label="Starts at" hint="Sri Lanka time" error={errors.starts_at}>
                <AInput name="starts_at" type="datetime-local" defaultValue={toLocalInput(workshop?.starts_at)} />
              </AField>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-semibold text-slate-700">Description</p>
                <RichText value={description} onChange={setDescription} name="description" minHeight={160} placeholder="What the workshop covers, who it is for, schedule…" />
              </div>
              <div className="sm:col-span-2">
                <ImageField label="Hero image" value={hero} onChange={setHero} name="hero_image" hint="Shown on the public registration page and event cards." />
              </div>
            </div>
          </Panel>

          <Panel title="Registration tracking" description="Attribute registrations to the social channel they came from.">
            <div className="grid gap-4 sm:grid-cols-2">
              <AField label="Registration page URL" error={errors.registration_page_url} hint="Absolute URL the tracking links point at.">
                <AInput name="registration_page_url" value={regUrl} onChange={(e) => { setRegUrlTouched(true); setRegUrlInput(e.target.value); }} placeholder={`${siteUrl}/register/${slug || "slug"}`} />
              </AField>
              <AField label="Campaign (utm_campaign)" error={errors.registration_campaign}>
                <AInput name="registration_campaign" value={campaign} onChange={(e) => { setCampaignTouched(true); setCampaignInput(e.target.value); }} />
              </AField>
            </div>
            {workshop ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-bold text-slate-900">Tracking links</p>
                  <p className="mb-2 text-xs text-slate-500">Share these per channel; registrations through them are counted by source.</p>
                  <TrackingLinks registrationUrl={regUrl} campaign={campaign} />
                </div>
                <SourceAnalytics data={sources} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">Tracking links and the source analytics appear after the workshop is saved.</p>
            )}
          </Panel>

          <Panel title="Registration form" description="Questions shown on the public registration form. Name and email are identity fields.">
            <FormBuilder name="form_fields" initial={workshop?.form_fields || {}} preview={{ mode: "workshop", title: title || "Workshop", description }} />
          </Panel>

          <Panel title="Certificate identity" description="Controls how certificate codes are generated for this workshop.">
            <div className="grid gap-4 sm:grid-cols-2">
              <AField label="Certificate ID prefix" error={errors.cert_id_prefix} hint="A–Z, 0–9 and hyphens. Leave blank to use ICET-WS<id>.">
                <AInput name="cert_id_prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="e.g. ICET-DEVOPS-2026" maxLength={30} className="font-mono uppercase" />
              </AField>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resulting code format</p>
                <p className="mt-1 font-mono text-slate-900">{codeExample}</p>
                <p className="mt-1 text-xs">8 random hexadecimal characters follow the prefix; codes are checked for uniqueness across all workshops.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Certificate background & coordinate mapper" description="Place each field on the template. Coordinates are stored in template pixels and used by the PDF generator.">
            <CertificateMapper templateName="certificate_template_url" mappingName="certificate_mapping" initialTemplateUrl={workshop?.certificate_template_url || ""} initialMapping={workshop?.certificate_mapping || []} workshopTitle={title} onSendTest={(input) => sendTestCertificateEmail({ ...input, workshop_title: title })} />
          </Panel>

          <Panel title="Response emails" description="Override the global templates for this workshop, or switch the confirmation off.">
            <EntityEmails name="email_settings" initial={workshop?.email_settings || {}} defaults={globalTemplates} showCert entityType="workshop" entityId={workshop?.id} />
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Panel title={workshop ? "Workshop" : "New workshop"}>
            <div className="space-y-3 text-sm">
              {workshop && (
                <>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><StatusBadge value={workshop.status} /></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Registrations</span><span className="font-semibold text-slate-900">{registrations}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">ID</span><span className="font-mono text-xs text-slate-700">#{workshop.id}</span></div>
                </>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <SubmitButton className="w-full"><Save className="h-4 w-4" /> {workshop ? "Save changes" : "Create workshop"}</SubmitButton>
                {workshop && (
                  <>
                    <IssueCertificatesButton workshopId={workshop.id} workshopTitle={workshop.title} status={workshop.status} variant="outline" size="md" />
                    {publicUrl && (
                      <div className="flex items-center gap-2">
                        <Button href={publicUrl} external variant="ghost" size="sm" className="flex-1"><Eye className="h-4 w-4" /> View public page</Button>
                        <CopyButton value={publicUrl} label="Copy URL" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Tips">
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-600">
              <li>Set the status to <strong>Active</strong> to open the public registration page.</li>
              <li>Mark attendance on the Students page before issuing certificates.</li>
              <li>Use <strong>Preview PDF</strong> to check the certificate layout before issuing.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </form>
  );
}
