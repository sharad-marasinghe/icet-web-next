"use client";

import * as React from "react";
import { useActionState } from "react";
import { Save, RotateCcw } from "lucide-react";
import type { SiteSettings } from "@/lib/data/settings";
import { Tabs, Panel, AField, AInput, ATextarea, ASelect, Toggle, SubmitButton, ActionToast, initialActionState, FieldError } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { TagInput } from "./helpers";
import { saveSettings } from "@/app/admin/(dashboard)/settings/actions";

const TABS = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contact" },
  { id: "social", label: "Social" },
  { id: "footer", label: "Footer" },
  { id: "announcement", label: "Announcement bar" },
  { id: "seo", label: "SEO defaults" },
  { id: "analytics", label: "Analytics" },
  { id: "stats", label: "Stats" },
  { id: "admissions", label: "Admissions" },
  { id: "other", label: "Other" },
];

// Which tab each error path belongs to, so we can surface counts on the tab strip.
const TAB_OF: Record<string, string> = {
  site_name: "general", tagline: "general", logo_url: "general", logo_dark_url: "general", favicon_url: "general", founded_year: "general", tvec_reg_no: "general", lms_url: "general",
  phone: "contact", phone_display: "contact", whatsapp: "contact", whatsapp_message: "contact", whatsapp_channel_url: "contact", email: "contact", email_academics: "contact", address_line1: "contact", address_line2: "contact", city: "contact", postal_code: "contact", country: "contact", map_url: "contact", map_embed_url: "contact", opening_hours: "contact",
  social: "social", footer_about: "footer", footer_copyright: "footer", announcement: "announcement", seo: "seo", analytics: "analytics", stats: "stats", apply: "admissions", google_review_url: "other", bank_details: "other",
};

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [state, action] = useActionState(saveSettings, initialActionState);
  const [tab, setTab] = React.useState("general");
  const [s, setS] = React.useState<SiteSettings>(initial);
  const [dirty, setDirty] = React.useState(false);
  const errors = state?.errors || {};

  const patch = React.useCallback((p: Partial<SiteSettings>) => { setS((prev) => ({ ...prev, ...p })); setDirty(true); }, []);
  function nested<K extends "social" | "announcement" | "seo" | "analytics" | "stats" | "apply">(key: K, p: Partial<SiteSettings[K]>) {
    setS((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
    setDirty(true);
  }
  // Adjust local state when a new action result arrives (render-time, no effect needed).
  const [seen, setSeen] = React.useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setDirty(false);
    else if (state?.errors) {
      const first = Object.keys(state.errors)[0];
      if (first) { const t = TAB_OF[first.split(".")[0]]; if (t) setTab(t); }
    }
  }

  const errCount = (id: string) => Object.keys(errors).filter((k) => TAB_OF[k.split(".")[0]] === id).length;
  const tabs = TABS.map((t) => ({ ...t, count: errCount(t.id) || undefined }));

  return (
    <form action={action} className="space-y-5">
      <ActionToast state={state} />
      <input type="hidden" name="payload" value={JSON.stringify(s)} />
      <Panel padded={false}>
        <div className="px-5 pt-2"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
        <div className="p-5">
          {tab === "general" && (
            <div className="grid gap-5 md:grid-cols-2">
              <AField label="Site name" required error={errors.site_name} className="md:col-span-2"><AInput value={s.site_name} onChange={(e) => patch({ site_name: e.target.value })} /></AField>
              <AField label="Tagline" error={errors.tagline} className="md:col-span-2"><AInput value={s.tagline} onChange={(e) => patch({ tagline: e.target.value })} /></AField>
              <div><ImageField label="Logo" value={s.logo_url} onChange={(v) => patch({ logo_url: v })} hint="Shown in the header on light backgrounds (SVG or PNG)." /><FieldError error={errors.logo_url} /></div>
              <div><ImageField label="Logo (dark backgrounds)" value={s.logo_dark_url} onChange={(v) => patch({ logo_dark_url: v })} hint="Used in the footer and hero sections." /><FieldError error={errors.logo_dark_url} /></div>
              <div><ImageField label="Favicon" value={s.favicon_url} onChange={(v) => patch({ favicon_url: v })} hint="Square PNG/SVG, at least 180×180." /><FieldError error={errors.favicon_url} /></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <AField label="Founded year" error={errors.founded_year}><AInput type="number" min={1900} max={2100} value={s.founded_year} onChange={(e) => patch({ founded_year: Number(e.target.value) })} /></AField>
                <AField label="TVEC registration no." error={errors.tvec_reg_no}><AInput value={s.tvec_reg_no} onChange={(e) => patch({ tvec_reg_no: e.target.value })} placeholder="P03/0177" /></AField>
              </div>
              <AField label="LMS / student portal URL" error={errors.lms_url} className="md:col-span-2"><AInput value={s.lms_url} onChange={(e) => patch({ lms_url: e.target.value })} placeholder="https://" /></AField>
            </div>
          )}

          {tab === "contact" && (
            <div className="grid gap-5 md:grid-cols-2">
              <AField label="Phone (tel: link)" hint="International format without spaces, e.g. +94705805805" error={errors.phone}><AInput value={s.phone} onChange={(e) => patch({ phone: e.target.value })} /></AField>
              <AField label="Phone (display)" error={errors.phone_display}><AInput value={s.phone_display} onChange={(e) => patch({ phone_display: e.target.value })} /></AField>
              <AField label="WhatsApp number" hint="Digits only with country code, e.g. 94705805805" error={errors.whatsapp}><AInput value={s.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value.replace(/[^\d]/g, "") })} /></AField>
              <AField label="WhatsApp channel URL" error={errors.whatsapp_channel_url}><AInput value={s.whatsapp_channel_url} onChange={(e) => patch({ whatsapp_channel_url: e.target.value })} /></AField>
              <AField label="WhatsApp pre-filled message" error={errors.whatsapp_message} className="md:col-span-2"><ATextarea value={s.whatsapp_message} onChange={(e) => patch({ whatsapp_message: e.target.value })} /></AField>
              <AField label="General email" error={errors.email}><AInput type="email" value={s.email} onChange={(e) => patch({ email: e.target.value })} /></AField>
              <AField label="Academics email" error={errors.email_academics}><AInput type="email" value={s.email_academics} onChange={(e) => patch({ email_academics: e.target.value })} /></AField>
              <AField label="Address line 1" error={errors.address_line1}><AInput value={s.address_line1} onChange={(e) => patch({ address_line1: e.target.value })} /></AField>
              <AField label="Address line 2" error={errors.address_line2}><AInput value={s.address_line2} onChange={(e) => patch({ address_line2: e.target.value })} /></AField>
              <div className="grid gap-5 sm:grid-cols-3 md:col-span-2">
                <AField label="City" error={errors.city}><AInput value={s.city} onChange={(e) => patch({ city: e.target.value })} /></AField>
                <AField label="Postal code" error={errors.postal_code}><AInput value={s.postal_code} onChange={(e) => patch({ postal_code: e.target.value })} /></AField>
                <AField label="Country" error={errors.country}><AInput value={s.country} onChange={(e) => patch({ country: e.target.value })} /></AField>
              </div>
              <AField label="Google Maps link" error={errors.map_url}><AInput value={s.map_url} onChange={(e) => patch({ map_url: e.target.value })} /></AField>
              <AField label="Map embed URL" hint="The src of the Google Maps iframe." error={errors.map_embed_url}><AInput value={s.map_embed_url} onChange={(e) => patch({ map_embed_url: e.target.value })} /></AField>
              <AField label="Opening hours" error={errors.opening_hours} className="md:col-span-2"><AInput value={s.opening_hours} onChange={(e) => patch({ opening_hours: e.target.value })} placeholder="Mon - Sun: 8:30 AM - 5:30 PM" /></AField>
            </div>
          )}

          {tab === "social" && (
            <div className="grid gap-5 md:grid-cols-2">
              {(["facebook", "youtube", "linkedin", "instagram", "tiktok", "x"] as const).map((k) => (
                <AField key={k} label={k === "x" ? "X (Twitter)" : k.charAt(0).toUpperCase() + k.slice(1)} error={errors[`social.${k}`]}>
                  <AInput value={s.social[k] || ""} onChange={(e) => nested("social", { [k]: e.target.value })} placeholder="https://" />
                </AField>
              ))}
            </div>
          )}

          {tab === "footer" && (
            <div className="grid gap-5">
              <AField label="About text" hint="Short paragraph shown under the logo in the footer." error={errors.footer_about}><ATextarea value={s.footer_about} onChange={(e) => patch({ footer_about: e.target.value })} /></AField>
              <AField label="Copyright line" hint={<>Use <code className="rounded bg-slate-100 px-1">{"{year}"}</code> to insert the current year automatically.</>} error={errors.footer_copyright}><AInput value={s.footer_copyright} onChange={(e) => patch({ footer_copyright: e.target.value })} /></AField>
            </div>
          )}

          {tab === "announcement" && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2"><Toggle checked={s.announcement.enabled} onChange={(v) => nested("announcement", { enabled: v })} label="Show announcement bar" description="A slim bar above the header on every public page." /></div>
              <AField label="Text" required={s.announcement.enabled} error={errors["announcement.text"]} className="md:col-span-2"><AInput value={s.announcement.text} onChange={(e) => nested("announcement", { text: e.target.value })} placeholder="Applications for the September intake are open" /></AField>
              <AField label="Link label" error={errors["announcement.link_label"]}><AInput value={s.announcement.link_label || ""} onChange={(e) => nested("announcement", { link_label: e.target.value })} placeholder="Apply now" /></AField>
              <AField label="Link URL" error={errors["announcement.link_url"]}><AInput value={s.announcement.link_url || ""} onChange={(e) => nested("announcement", { link_url: e.target.value })} placeholder="/apply" /></AField>
              <AField label="Tone" error={errors["announcement.tone"]}>
                <ASelect value={s.announcement.tone || "brand"} onChange={(e) => nested("announcement", { tone: e.target.value as SiteSettings["announcement"]["tone"] })}>
                  <option value="brand">Brand blue</option><option value="navy">Navy</option><option value="green">Green</option>
                </ASelect>
              </AField>
            </div>
          )}

          {tab === "seo" && (
            <div className="grid gap-5">
              <AField label="Default title" error={errors["seo.default_title"]} hint={`${s.seo.default_title.length}/70 characters recommended`}><AInput value={s.seo.default_title} onChange={(e) => nested("seo", { default_title: e.target.value })} /></AField>
              <AField label="Title template" hint={<>Use <code className="rounded bg-slate-100 px-1">%s</code> where the page title goes.</>} error={errors["seo.title_template"]}><AInput value={s.seo.title_template} onChange={(e) => nested("seo", { title_template: e.target.value })} /></AField>
              <AField label="Default description" error={errors["seo.default_description"]} hint={`${s.seo.default_description.length}/160 characters recommended`}><ATextarea value={s.seo.default_description} onChange={(e) => nested("seo", { default_description: e.target.value })} /></AField>
              <div><ImageField label="Default social (Open Graph) image" value={s.seo.default_og_image} onChange={(v) => nested("seo", { default_og_image: v })} hint="1200×630 recommended. Used when a page has no image of its own." /><FieldError error={errors["seo.default_og_image"]} /></div>
              <AField label="Keywords" hint="Press Enter or comma after each keyword." error={errors["seo.keywords"]}><TagInput value={s.seo.keywords} onChange={(v) => nested("seo", { keywords: v })} placeholder="software engineering courses sri lanka" /></AField>
              <AField label="Twitter / X handle" error={errors["seo.twitter_handle"]}><AInput value={s.seo.twitter_handle || ""} onChange={(e) => nested("seo", { twitter_handle: e.target.value })} placeholder="@icet" className="sm:max-w-xs" /></AField>
            </div>
          )}

          {tab === "analytics" && (
            <div className="grid gap-5 md:grid-cols-2">
              <AField label="Google Analytics 4 ID" hint="G-XXXXXXXXXX" error={errors["analytics.ga4_id"]}><AInput value={s.analytics.ga4_id || ""} onChange={(e) => nested("analytics", { ga4_id: e.target.value })} /></AField>
              <AField label="Google Tag Manager ID" hint="GTM-XXXXXXX" error={errors["analytics.gtm_id"]}><AInput value={s.analytics.gtm_id || ""} onChange={(e) => nested("analytics", { gtm_id: e.target.value })} /></AField>
              <AField label="Meta (Facebook) Pixel ID" error={errors["analytics.fb_pixel_id"]}><AInput value={s.analytics.fb_pixel_id || ""} onChange={(e) => nested("analytics", { fb_pixel_id: e.target.value })} /></AField>
              <AField label="Microsoft Clarity ID" error={errors["analytics.clarity_id"]}><AInput value={s.analytics.clarity_id || ""} onChange={(e) => nested("analytics", { clarity_id: e.target.value })} /></AField>
              <AField label="Google site verification" hint="Content of the google-site-verification meta tag." error={errors["analytics.google_site_verification"]} className="md:col-span-2"><AInput value={s.analytics.google_site_verification || ""} onChange={(e) => nested("analytics", { google_site_verification: e.target.value })} /></AField>
            </div>
          )}

          {tab === "stats" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AField label="Professionals trained" error={errors["stats.professionals_trained"]}><AInput type="number" min={0} value={s.stats.professionals_trained} onChange={(e) => nested("stats", { professionals_trained: Number(e.target.value) })} /></AField>
              <AField label="Years of excellence" error={errors["stats.years_excellence"]}><AInput type="number" min={0} value={s.stats.years_excellence} onChange={(e) => nested("stats", { years_excellence: Number(e.target.value) })} /></AField>
              <AField label="Current students" error={errors["stats.current_students"]}><AInput type="number" min={0} value={s.stats.current_students} onChange={(e) => nested("stats", { current_students: Number(e.target.value) })} /></AField>
              <AField label="Industry partners" error={errors["stats.partners"]}><AInput type="number" min={0} value={s.stats.partners} onChange={(e) => nested("stats", { partners: Number(e.target.value) })} /></AField>
              <AField label="Placement rate" hint="Free text, e.g. 95%" error={errors["stats.placement_rate"]}><AInput value={s.stats.placement_rate || ""} onChange={(e) => nested("stats", { placement_rate: e.target.value })} /></AField>
            </div>
          )}

          {tab === "admissions" && (
            <div className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <AField label="Intake label" error={errors["apply.intake_label"]}><AInput value={s.apply.intake_label} onChange={(e) => nested("apply", { intake_label: e.target.value })} placeholder="2026 SEPTEMBER INTAKE" /></AField>
                <AField label="Intake subtitle" error={errors["apply.intake_subtitle"]}><AInput value={s.apply.intake_subtitle} onChange={(e) => nested("apply", { intake_subtitle: e.target.value })} /></AField>
              </div>
              <AField label="Success message" hint="Shown after an inquiry is submitted and included in the confirmation email." error={errors["apply.success_message"]}><ATextarea value={s.apply.success_message} onChange={(e) => nested("apply", { success_message: e.target.value })} /></AField>
              <AField label="Notify these emails" hint="New inquiries are emailed to each address. Press Enter after each one." error={errors["apply.notify_emails"] || Object.entries(errors).find(([k]) => k.startsWith("apply.notify_emails."))?.[1]}>
                <TagInput value={s.apply.notify_emails} onChange={(v) => nested("apply", { notify_emails: v })} placeholder="info@icet.lk" validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)} />
              </AField>
            </div>
          )}

          {tab === "other" && (
            <div className="grid gap-5">
              <AField label="Google review URL" hint="Used by the feedback redirect flow for happy respondents." error={errors.google_review_url}><AInput value={s.google_review_url} onChange={(e) => patch({ google_review_url: e.target.value })} /></AField>
              <AField label="Bank details" hint="Shown to applicants for fee payments. One item per line." error={errors.bank_details}><ATextarea rows={6} value={s.bank_details} onChange={(e) => patch({ bank_details: e.target.value })} /></AField>
            </div>
          )}
        </div>
      </Panel>
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-3 shadow-elev backdrop-blur">
        <p className="text-sm text-slate-500">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={() => { setS(initial); setDirty(false); }}><RotateCcw className="h-4 w-4" /> Discard</Button>
          <SubmitButton size="sm"><Save className="h-4 w-4" /> Save settings</SubmitButton>
        </div>
      </div>
    </form>
  );
}
