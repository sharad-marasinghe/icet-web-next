/**
 * Registration / intake form field model — shared by the public renderer, the
 * server validator and the admin form builder. Port of ICET_CM_Form_Fields.
 */
export type FieldType = "text" | "textarea" | "radio" | "checkbox" | "select" | "file" | "date" | "number" | "email" | "tel" | "section" | "heading";

export type FieldConfig = {
  enabled: boolean;
  required: boolean;
  filterable: boolean;
  type: FieldType;
  label: string;
  help: string;            // sanitised inline HTML
  width: "full" | "half";
  selection_mode: "single" | "multiple";
  options: string[];
  pattern: string;
  min: string;
  max: string;
  maxlength: number;
  placeholder?: string;
};

export type FormFields = Record<string, FieldConfig>;

export const QUESTION_TYPES: Record<Exclude<FieldType, "section" | "heading">, string> = {
  text: "Short answer", textarea: "Paragraph", radio: "Multiple choice", checkbox: "Checkboxes", select: "Dropdown",
  file: "File upload", date: "Date", number: "Number", email: "Email", tel: "Phone",
};
export const LAYOUT_TYPES: Record<"section" | "heading", string> = { section: "Page break", heading: "Title & description" };
export const ALL_TYPES = { ...QUESTION_TYPES, ...LAYOUT_TYPES } as Record<FieldType, string>;

export const STANDARD_FIELDS: Record<string, string> = {
  student_name: "Full Name", student_email: "Email Address", student_id: "Student ID", student_phone: "Phone Number",
  nic: "NIC Number", organization: "University / Company", batch_number: "Batch Number", designation: "Designation", district: "District",
};
export const IDENTITY_FIELDS: Record<string, FieldType> = { student_name: "text", student_email: "email" };
export const CORE_COLUMNS = ["student_name", "student_email", "student_id", "student_phone"];
const CHOICE = ["select", "radio", "checkbox"];
const TEXTUAL = ["text", "tel", "email", "textarea"];
const BOUNDED = ["number", "date"];
const UNFILTERABLE = ["textarea", "file", "section", "heading"];

export const UPLOAD_MIMES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg", png: "image/png", webp: "image/webp" };
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ACCEPT = [...new Set([...Object.keys(UPLOAD_MIMES).map((e) => "." + e), ...Object.values(UPLOAD_MIMES)])].join(",");

export const isLayout = (t: string) => t === "section" || t === "heading";
export const isPageBreak = (t: string) => t === "section";
export const isChoice = (t: string) => CHOICE.includes(t);
export const canFilter = (t: string) => !UNFILTERABLE.includes(t);
export const isCoreColumn = (k: string) => CORE_COLUMNS.includes(k);
export const isMulti = (c: Pick<FieldConfig, "selection_mode" | "type">) => c.selection_mode === "multiple" && isChoice(c.type);

export function sanitizeKey(k: string) {
  return String(k).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 64);
}

function safePattern(p: string): string {
  const s = String(p || "").trim().slice(0, 255);
  if (!s) return "";
  try {
    new RegExp(`^(?:${s})$`, "u");
    return s;
  } catch {
    return "";
  }
}

const stripTags = (s: string) => String(s ?? "").replace(/<[^>]*>/g, "").trim();

/** Sanitise one raw field config into the canonical shape. `sanitizeHelp` is injected (server vs client). */
export function sanitizeConfig(rawKey: string, raw: unknown, sanitizeHelp: (html: string) => string = (h) => h): FieldConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let type = String(c.type || "text") as FieldType;
  if (!(type in ALL_TYPES)) type = "text";
  if (rawKey in IDENTITY_FIELDS) type = IDENTITY_FIELDS[rawKey];
  const width = c.width === "half" ? "half" : "full";
  let selection_mode: "single" | "multiple" = c.selection_mode === "multiple" ? "multiple" : "single";
  if (!isChoice(type)) selection_mode = "single";
  let rawOptions: unknown = c.options ?? [];
  if (typeof rawOptions === "string") rawOptions = rawOptions.split(/\r\n|\r|\n/);
  const options = isChoice(type) && Array.isArray(rawOptions) ? [...new Set((rawOptions as unknown[]).filter((o) => typeof o === "string" || typeof o === "number").map((o) => stripTags(String(o))).filter(Boolean))] : [];
  const pattern = TEXTUAL.includes(type) ? safePattern(String(c.pattern ?? "")) : "";
  const min = BOUNDED.includes(type) ? stripTags(String(c.min ?? "")) : "";
  const max = BOUNDED.includes(type) ? stripTags(String(c.max ?? "")) : "";
  const maxlength = TEXTUAL.includes(type) ? Math.min(5000, Math.max(0, parseInt(String(c.maxlength ?? 0), 10) || 0)) : 0;
  return {
    enabled: !!c.enabled,
    required: !!c.required && !isLayout(type),
    filterable: !!c.filterable && canFilter(type),
    type,
    label: stripTags(String(c.label ?? "")) || rawKey.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    help: sanitizeHelp(String(c.help ?? "")),
    width,
    selection_mode,
    options,
    pattern,
    min,
    max,
    maxlength,
    placeholder: c.placeholder ? stripTags(String(c.placeholder)).slice(0, 120) : undefined,
  };
}

export function sanitizeForm(raw: unknown, sanitizeHelp?: (html: string) => string): FormFields {
  let obj = raw;
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return {}; }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: FormFields = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = sanitizeKey(k);
    if (!key) continue;
    out[key] = sanitizeConfig(key, v, sanitizeHelp);
  }
  return out;
}

/** Inject name + email into definitions that predate configurable identity fields. */
export function normalizeIdentityFields(form: FormFields): FormFields {
  for (const k of Object.keys(IDENTITY_FIELDS)) if (k in form) return form;
  const defaults: FormFields = {};
  for (const [k, t] of Object.entries(IDENTITY_FIELDS)) defaults[k] = sanitizeConfig(k, { enabled: true, required: true, type: t, label: STANDARD_FIELDS[k] });
  const keys = Object.keys(form);
  const first = keys[0];
  if (first && form[first]?.enabled && isPageBreak(form[first].type)) {
    const { [first]: head, ...rest } = form;
    return { [first]: head, ...defaults, ...rest };
  }
  return { ...defaults, ...form };
}

export type FormPage = { title: string; desc: string; fields: [string, FieldConfig][] };
export function buildPages(form: FormFields): FormPage[] {
  const pages: FormPage[] = [{ title: "", desc: "", fields: [] }];
  let cur = 0;
  for (const [k, conf] of Object.entries(form)) {
    if (!conf.enabled) continue;
    if (isPageBreak(conf.type)) {
      pages.push({ title: conf.label, desc: conf.help, fields: [] });
      cur = pages.length - 1;
      continue;
    }
    pages[cur].fields.push([k, conf]);
  }
  return pages.filter((p) => p.fields.length || p.title || p.desc);
}

export function fieldName(key: string, conf: FieldConfig) {
  if (conf.type === "file") return `files[${key}]`;
  if (isCoreColumn(key)) return key;
  return isMulti(conf) ? `extra[${key}][]` : `extra[${key}]`;
}

export type ValidationResult = { ok: true; value: string | string[] } | { ok: false; error: string };

/** Validate and normalise one submitted answer. Required-ness is checked by the caller. */
export function validateAnswer(conf: FieldConfig, raw: unknown): ValidationResult {
  const label = conf.label || "This field";
  if (conf.type === "file" || isLayout(conf.type)) return { ok: true, value: "" };
  if (isMulti(conf)) {
    const arr = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
    const vals: string[] = [];
    for (const item of arr) {
      if (typeof item !== "string" && typeof item !== "number") continue;
      const v = stripTags(String(item));
      if (!v) continue;
      if (conf.options.length && !conf.options.includes(v)) return { ok: false, error: `${label} contains a selection that is not available.` };
      vals.push(v);
    }
    return { ok: true, value: [...new Set(vals)] };
  }
  if (Array.isArray(raw)) return { ok: true, value: "" };
  const value = String(raw ?? "").trim();
  if (!value) return { ok: true, value: "" };
  switch (conf.type) {
    case "number": {
      if (!/^-?\d+(\.\d+)?$/.test(value)) return { ok: false, error: `${label} must be a number.` };
      return bounds(conf, Number(value), label, value, false);
    }
    case "email": {
      const v = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { ok: false, error: `${label} must be a valid email address.` };
      return { ok: true, value: v };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: `${label} must be a date in YYYY-MM-DD format.` };
      return bounds(conf, Date.parse(value), label, value, true);
    }
    case "select":
    case "radio":
    case "checkbox": {
      const v = stripTags(value);
      if (conf.options.length && !conf.options.includes(v)) return { ok: false, error: `${label} is not one of the available options.` };
      return { ok: true, value: v };
    }
    case "textarea": {
      const v = stripTags(value);
      return textRules(conf, v, label);
    }
    default: {
      const v = stripTags(value).replace(/\s+/g, " ");
      return textRules(conf, v, label);
    }
  }
}
function textRules(conf: FieldConfig, v: string, label: string): ValidationResult {
  if (conf.maxlength > 0 && v.length > conf.maxlength) return { ok: false, error: `${label} must be ${conf.maxlength} characters or fewer.` };
  if (conf.pattern) {
    try {
      if (!new RegExp(`^(?:${conf.pattern})$`, "u").test(v)) return { ok: false, error: `${label} is not in the expected format.` };
    } catch { /* ignore broken pattern */ }
  }
  return { ok: true, value: v };
}
function bounds(conf: FieldConfig, cmp: number, label: string, original: string, asDate: boolean): ValidationResult {
  if (conf.min) {
    const b = asDate ? Date.parse(conf.min) : Number(conf.min);
    if (Number.isFinite(b) && cmp < b) return { ok: false, error: `${label} must not be earlier or less than ${conf.min}.` };
  }
  if (conf.max) {
    const b = asDate ? Date.parse(conf.max) : Number(conf.max);
    if (Number.isFinite(b) && cmp > b) return { ok: false, error: `${label} must not be later or greater than ${conf.max}.` };
  }
  return { ok: true, value: original };
}

export function hasUploads(form: FormFields) {
  return Object.values(form).some((c) => c.enabled && c.type === "file");
}

/* ───────────────────────── Attribution helpers ───────────────────────── */
export const SOCIAL_SOURCES: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok", whatsapp: "WhatsApp", youtube: "YouTube", x: "X / Twitter" };
export function normalizeSource(v: unknown, fallback = "direct") {
  if (typeof v !== "string" && typeof v !== "number") return fallback;
  const s = String(v).toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 100);
  return s || fallback;
}
export function normalizeUtm(v: unknown, max: number) {
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v).toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, max);
}
export function sourceLabel(src: string) {
  const s = normalizeSource(src);
  return SOCIAL_SOURCES[s] || (s === "direct" ? "Direct" : s === "twitter" ? "X / Twitter" : s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
}
export function defaultCampaign(title: string, id = 0) {
  return normalizeUtm(title, 140) || (id ? `workshop_${id}` : "workshop");
}
export function trackingUrl(regUrl: string, source: string, campaign: string) {
  try {
    const u = new URL(regUrl);
    u.searchParams.set("utm_source", normalizeSource(source));
    u.searchParams.set("utm_medium", "social");
    u.searchParams.set("utm_campaign", normalizeUtm(campaign, 150));
    return u.toString();
  } catch {
    return "";
  }
}

/* ───────────────────────── Email templates ───────────────────────── */
export type EmailTemplate = { sender_name: string; reply_to: string; subject: string; body: string };
export type EntityEmailSettings = { reg?: Partial<EmailTemplate> & { mode?: "default" | "custom" | "off" }; cert?: Partial<EmailTemplate> & { mode?: "default" | "custom" } };
export const EMAIL_PLACEHOLDERS = {
  reg: ["{student_name}", "{workshop_title}", "{reference_no}", "{student_id}"],
  cert: ["{student_name}", "{workshop_title}", "{certificate_code}", "{certificate_link}", "{student_id}"],
} as const;

export const DEFAULT_EMAILS: { reg: EmailTemplate; cert: EmailTemplate } = {
  reg: {
    sender_name: "iCET Professional Development Unit",
    reply_to: "pdu@icet.lk",
    subject: "You are In! Registration Confirmed for {workshop_title}",
    body: `<p>Dear {student_name},</p><p>Thank you for registering for <strong>{workshop_title}</strong>.</p><p>Your reference: <strong>{reference_no}</strong> — please quote it in any correspondence.</p><p>We will share further details closer to the date.</p><p>Regards,<br>iCET – Institute of Computer Engineering Technology</p>`,
  },
  cert: {
    sender_name: "iCET - Institute of Computer Engineering Technology",
    reply_to: "info@icet.lk",
    subject: "Your Certificate is Ready – {workshop_title}",
    body: `<p>Dear {student_name},</p><p>Congratulations! Your certificate for <strong>{workshop_title}</strong> is ready.</p><p>Certificate code: <strong>{certificate_code}</strong><br>Verify & download: <a href="{certificate_link}">{certificate_link}</a></p><p>Regards,<br>iCET – Institute of Computer Engineering Technology</p>`,
  },
};

export function resolveTemplate(type: "reg" | "cert", global: EmailTemplate, entity: EntityEmailSettings | null | undefined): EmailTemplate | null {
  const own = (entity?.[type] || {}) as Partial<EmailTemplate> & { mode?: string };
  const mode = own.mode || "default";
  if (type === "reg" && mode === "off") return null;
  if (mode !== "custom") return global;
  const tpl = { ...global };
  for (const f of ["sender_name", "reply_to", "subject", "body"] as const) {
    const v = String(own[f] ?? "").trim();
    if (v) tpl[f] = v;
  }
  return tpl;
}

export function renderTemplate(tpl: EmailTemplate, vars: Record<string, string>) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let subject = tpl.subject;
  let body = tpl.body;
  for (const [k, v] of Object.entries(vars)) {
    subject = subject.split(k).join(v);
    body = body.split(k).join(k === "{certificate_link}" ? esc(v) : esc(v));
  }
  return { subject: subject.replace(/[\r\n]+/g, " ").trim(), body };
}
