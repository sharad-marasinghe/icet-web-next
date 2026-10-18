import Link from "next/link";
import { Phone, Mail, MessageCircle, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml, sanitizeInline } from "@/lib/sanitize";
import type { FormData as FormBlockData } from "@/lib/blocks/types";
import { getPrograms } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { getPublicWorkshop, getPublicBatch, getPublicFeedbackForm } from "@/lib/data/registry";
import { normalizeIdentityFields, sanitizeForm } from "@/lib/registry/fields";
import { ApplyForm } from "./apply-form";
import { ContactForm } from "./contact-form";
import { RegistrationForm } from "./registration-form";
import { FeedbackForm } from "./feedback-form";
import { VerifyCertificate } from "./verify-certificate";
import { Notice } from "@/components/ui/primitives";

/** Server component: resolves the form configuration and renders the client form. */
export async function FormBlock({ data: d, invert, bare, initialCode }: { data: FormBlockData; invert?: boolean; bare?: boolean; initialCode?: string }) {
  const settings = await getSettings();
  let body: React.ReactNode = null;

  switch (d.kind) {
    case "apply": {
      const programs = await getPrograms();
      body = <ApplyForm programs={programs.map((p) => ({ code: p.code, name: p.name, qualification: p.qualification }))} intakeLabel={settings.apply?.intake_label} preselect={d.program_code} successMessage={d.success_message || settings.apply?.success_message} />;
      break;
    }
    case "contact":
      body = <ContactForm successMessage={d.success_message} />;
      break;
    case "workshop": {
      const w = d.workshop_slug ? await getPublicWorkshop(d.workshop_slug) : null;
      if (!w || w.status !== "active") {
        body = <Notice tone="warning">Workshop not found or registrations are closed.</Notice>;
      } else {
        const fields = normalizeIdentityFields(sanitizeForm(w.form_fields, sanitizeInline));
        body = <RegistrationForm mode="workshop" targetId={w.id} title={w.title} description={sanitizeHtml(w.description)} fields={fields} sourceTracking showHeader={d.show_header} />;
      }
      break;
    }
    case "batch": {
      const b = d.batch_slug ? await getPublicBatch(d.batch_slug) : null;
      if (!b) {
        body = <Notice tone="warning">Batch not found.</Notice>;
      } else if (!b.is_open) {
        body = <Notice tone="warning">Applications for {b.batch_name} are currently closed. Please contact your student counsellor.</Notice>;
      } else {
        const fields = normalizeIdentityFields(sanitizeForm(b.form_fields, sanitizeInline));
        body = <RegistrationForm mode="batch" targetId={b.id} title={b.intro_title || b.batch_name} description={sanitizeHtml(b.intro_html)} fields={fields} showHeader={d.show_header} successTitle="Application submitted!" />;
      }
      break;
    }
    case "feedback": {
      const f = await getPublicFeedbackForm(d.feedback_slug || null);
      body = f ? <FeedbackForm slug={f.slug} questions={f.questions} submitLabel={f.submit_label} introHtml={sanitizeHtml(f.intro_html)} /> : <Notice tone="warning">Feedback form not found.</Notice>;
      break;
    }
    case "verify":
      body = <VerifyCertificate initialCode={initialCode} />;
      break;
    default:
      body = <ContactForm />;
  }

  if (bare) return <>{body}</>;

  const header = (d.title || d.description || d.eyebrow) && (
    <div className={cn("mb-8", !d.sidebar && "mx-auto max-w-2xl text-center")}>
      {d.eyebrow && <p className={cn("eyebrow mb-2", invert && "text-brand-300")}>{d.eyebrow}</p>}
      {d.title && <h2 className={cn("h-section", invert && "text-white")}>{d.title}</h2>}
      {d.description && <div className={cn("prose-icet mt-3", invert && "prose-invert")} dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.description) }} />}
    </div>
  );

  if (!d.sidebar) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        {d.kind === "apply" || d.kind === "contact" ? <div className="card p-6 sm:p-8">{body}</div> : body}
      </div>
    );
  }

  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(settings.whatsapp_message)}`;
  return (
    <div>
      {header}
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>{d.kind === "apply" || d.kind === "contact" ? <div className="card p-6 sm:p-8">{body}</div> : body}</div>
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <div className="rounded-2xl bg-navy-grad p-6 text-white">
            <p className="eyebrow text-brand-200">Talk to a counsellor</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Prefer to speak with us?</h3>
            <p className="mt-2 text-sm text-slate-200">Our admissions team answers questions about programmes, fees and payment plans every day.</p>
            <ul className="mt-5 space-y-3 text-sm">
              <li><a href={`tel:${settings.phone}`} className="flex items-center gap-3 font-semibold hover:text-brand-200"><Phone className="h-4 w-4 text-brand-300" />{settings.phone_display}</a></li>
              <li><a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-semibold hover:text-brand-200"><MessageCircle className="h-4 w-4 text-brand-300" />Chat on WhatsApp</a></li>
              <li><a href={`mailto:${settings.email}`} className="flex items-center gap-3 font-semibold hover:text-brand-200"><Mail className="h-4 w-4 text-brand-300" />{settings.email}</a></li>
              <li className="flex items-center gap-3 text-slate-300"><Clock className="h-4 w-4 text-brand-300" />{settings.opening_hours}</li>
            </ul>
          </div>
          {d.image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.image.url} alt={d.image.alt || ""} className="w-full rounded-2xl object-cover shadow-card" />
          ) : (
            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-slate-900">What happens next?</h3>
              <ol className="mt-4 space-y-3 text-sm text-slate-600">
                {["A counsellor contacts you within one working day.", "We recommend the right programme and share the offer letter.", "Choose a payment plan and complete registration."].map((s, i) => (
                  <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>{s}</li>
                ))}
              </ol>
              <Link href="/professional-it-courses-in-sri-lanka" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">Compare programmes <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
