/**
 * Content migration: WordPress (icet.lk) → Supabase.
 * Idempotent: re-running updates rows in place (keyed by slug/code/path).
 *
 *   npm run seed            # everything (media upload can take a few minutes)
 *   SKIP_MEDIA=1 npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import { sql, getToken, uploadFile, MIME, readJson, slugify, bid, imageSize } from "./lib";
import { looksLikeHtml } from "./lib";

const LEGACY_DIR = process.env.LEGACY_MEDIA_DIR || "/tmp/claude-1000/-run-media-sharadamarasinghe-01DCB46A126F9D70-iCET-web-next/fddb6949-9408-4df4-a0ad-abb7c1f8c86e/scratchpad/site/dl";
const CAMPUS_DIR = process.env.CAMPUS_DIR || path.resolve(process.cwd(), "../icet-web/WEB IMAGES/WEB IMAGES");
const WP = "https://icet.lk/wp-content/uploads/";

type MediaRow = { id: string; url: string; width: number | null; height: number | null };
const mediaByRel = new Map<string, MediaRow>();
let token = "";

async function registerMedia(bucketPath: string, buf: Buffer, mime: string, folder: string, filename: string, alt = "") {
  const dims = imageSize(buf);
  const url = await uploadFile(token, "media", bucketPath, buf, mime);
  const rows = await sql<MediaRow[]>`insert into public.media (bucket, path, url, folder, filename, title, alt, mime_type, size_bytes, width, height)
    values ('media', ${bucketPath}, ${url}, ${folder}, ${filename}, ${filename.replace(/\.[^.]+$/, "")}, ${alt}, ${mime}, ${buf.length}, ${dims?.width ?? null}, ${dims?.height ?? null})
    on conflict (bucket, path) do update set size_bytes = excluded.size_bytes, width = excluded.width, height = excluded.height, mime_type = excluded.mime_type
    returning id, url, width, height`;
  return rows[0];
}

/** Map a legacy upload URL (or relative path) to its migrated public URL, uploading on demand. */
async function U(legacy: string | null | undefined): Promise<string | null> {
  if (!legacy) return null;
  let rel = legacy.startsWith(WP) ? legacy.slice(WP.length) : legacy.startsWith("http") ? null : legacy.replace(/^\/+/, "");
  if (!rel) return legacy; // foreign URL — keep
  rel = rel.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1"); // prefer originals
  const hit = mediaByRel.get(rel);
  if (hit) return hit.url;
  const ext = (rel.split(".").pop() || "").toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  let buf: Buffer | null = null;
  const local = path.join(LEGACY_DIR, rel);
  if (fs.existsSync(local)) buf = fs.readFileSync(local);
  else {
    try {
      const res = await fetch(WP + rel, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    } catch { /* ignore */ }
  }
  if (!buf || (ext !== "svg" && looksLikeHtml(buf))) {
    console.warn("  ! missing media", rel);
    return legacy;
  }
  const row = await registerMedia(`legacy/${rel}`, buf, mime, "legacy/" + rel.split("/").slice(0, 2).join("/"), path.basename(rel));
  mediaByRel.set(rel, row);
  return row.url;
}
const img = async (legacy: string, alt = "") => ({ url: (await U(legacy))!, alt });

async function rewriteHtml(html: string) {
  const urls = [...new Set(html.match(/https:\/\/icet\.lk\/wp-content\/uploads\/[^"'\s)]+/g) || [])];
  let out = html;
  for (const u of urls) {
    const n = await U(u);
    if (n) out = out.split(u).join(n);
  }
  // strip WPForms/CSS debris that leaked into event descriptions
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/#wpforms-\d+[^<]*/g, "").replace(/<div class="wpforms-container[\s\S]*?<\/form>\s*<\/div>/gi, "").replace(/<form[\s\S]*?<\/form>/gi, "");
  return out.trim();
}

async function uploadMediaLibrary() {
  if (process.env.SKIP_MEDIA) {
    const rows = await sql<(MediaRow & { path: string })[]>`select id, url, width, height, path from public.media where path like 'legacy/%' or path like 'campus/%'`;
    for (const r of rows) mediaByRel.set(r.path.replace(/^legacy\//, ""), r);
    console.log(`media: loaded ${rows.length} existing rows`);
    return;
  }
  const existing = await sql<{ path: string; id: string; url: string; width: number | null; height: number | null }[]>`select path, id, url, width, height from public.media`;
  for (const r of existing) if (r.path.startsWith("legacy/")) mediaByRel.set(r.path.slice(7), r);
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } };
  if (fs.existsSync(LEGACY_DIR)) walk(LEGACY_DIR);
  let n = 0;
  for (const f of files) {
    const rel = path.relative(LEGACY_DIR, f).split(path.sep).join("/");
    if (mediaByRel.has(rel)) continue;
    const ext = (rel.split(".").pop() || "").toLowerCase();
    if (!MIME[ext]) continue;
    const buf = fs.readFileSync(f);
    if (buf.length > 15 * 1024 * 1024) continue;
    if (ext !== "svg" && looksLikeHtml(buf)) { console.warn("  ! skipping HTML error page saved as", rel); continue; }
    try {
      const row = await registerMedia(`legacy/${rel}`, buf, MIME[ext], "legacy/" + rel.split("/").slice(0, 2).join("/"), path.basename(rel));
      mediaByRel.set(rel, row);
      n++;
      if (n % 25 === 0) console.log(`  uploaded ${n}…`);
    } catch (e) { console.warn("  upload failed", rel, (e as Error).message); }
  }
  console.log(`media: uploaded ${n} legacy files (${mediaByRel.size} total)`);
  // Campus photography (authentic imagery recommended by the UX audit)
  if (fs.existsSync(CAMPUS_DIR)) {
    for (const f of fs.readdirSync(CAMPUS_DIR)) {
      const ext = f.split(".").pop()!.toLowerCase();
      if (!["jpg", "jpeg"].includes(ext)) continue;
      const rel = `campus/${f.toLowerCase()}`;
      if (mediaByRel.has(rel)) continue;
      const buf = fs.readFileSync(path.join(CAMPUS_DIR, f));
      if (buf.length > 6 * 1024 * 1024) continue;
      const row = await registerMedia(rel, buf, "image/jpeg", "campus", f.toLowerCase(), "iCET students on campus");
      mediaByRel.set(rel, row);
    }
    console.log("media: campus photos ready");
  }
}
const campus = (name: string) => mediaByRel.get(`campus/${name}`)?.url || null;

/* ───────────────────────── Settings & navigation ───────────────────────── */
async function seedSettings() {
  const logo = await U("2025/06/iCET-logo-scaled.png");
  const favicon = await U("2025/07/cropped-Black-White-Minimalist-Professional-Initial-Logo-192x192.png");
  const og = await U("2025/06/websitemainbanner.jpg");
  const site = {
    logo_url: logo, logo_dark_url: logo, favicon_url: favicon,
    seo: { default_og_image: og },
    announcement: { enabled: true, text: "Admissions open for the 2026 September intake — limited seats for iCD & iCP.", link_label: "Apply now", link_url: "/apply", tone: "brand" },
    stats: { professionals_trained: 15000, years_excellence: 21, current_students: 1000, partners: 50 },
    bank_details: "Commercial Bank · Account 1001008934 · Institute of Computer Engineering Technology (PVT) Ltd · Panadura Branch (041) · SWIFT CCEYLKLX",
  };
  await sql`insert into public.site_settings (key, value, is_public) values ('site', ${sql.json(site as never)}, true)
    on conflict (key) do update set value = public.site_settings.value || excluded.value, updated_at = now()`;
  await sql`insert into public.navigation_menus (slug, title, items) values ('header','Header menu','[]'::jsonb),('footer_quick','Footer – Quick links','[]'::jsonb),('footer_programs','Footer – Programmes','[]'::jsonb),('footer_legal','Footer – Legal','[]'::jsonb) on conflict (slug) do nothing`;
  console.log("settings ✓");
}

/* ───────────────────────── Programmes ───────────────────────── */
const CTA_APPLY = { label: "Begin your application", href: "/apply" };
const STEPS_REGISTER = {
  eyebrow: "Getting started", title: "Four steps from first call to registration", layout: "horizontal", numbered: true,
  items: [
    { title: "Contact your counsellor", description: "Call or WhatsApp the hotline +94 705 805 805 to speak with a student counsellor." },
    { title: "Request your offer letter", description: "It includes programme content, laptop specifications and payment details." },
    { title: "Choose a payment plan", description: "Full-time or part-time, early bird, discount or installments." },
    { title: "Submit & register", description: "Send your payment receipt with the signed offer letter — your counsellor completes registration." },
  ],
  note: "Find your student counsellor: +94 705 805 805 · info@icet.lk",
  cta: CTA_APPLY,
};
const PROGRAM_CTA = (code: string) => ({ style: "banner", eyebrow: "Limited seats available", title: "Ready to start your software engineering career?", description: `Join the next ${code} intake and learn from practising engineers with real industry training built in.`, primary_cta: { label: "Begin your application", href: `/apply?program=${code}`, variant: "white" }, secondary_cta: { label: "Talk to a counsellor", href: "/contact-us", variant: "ghost" } });

async function seedPrograms() {
  const icm = await U("2025/06/iCMlogo-scaled.png"), icd = await U("2025/06/iCDlogo-scaled.png"), icp = await U("2025/06/iCPlogo.png");
  const frank = await U("2026/06/Frank-sir.png");
  const programs = [
    {
      code: "iCM", slug: "software-development-course-university-students", name: "iCET Certified Master", qualification: "Certificate in Software Development",
      tagline: "A hands-on, industry-focused software development programme designed for university students who want to build practical, job-ready skills alongside their degree.",
      summary: "Skill-development-focused 6-month programme providing in-depth, practical knowledge in software development — from Java fundamentals to Spring Boot and Angular.",
      level_label: "PROFESSIONAL CERTIFICATE · 6 MONTHS · NO EXPERIENCE NEEDED", duration: "6 months", training: "Project-based learning", mode: "Online / Physical / Hybrid",
      logo_url: icm, fee_from: 125000, accent: "#16a34a", sort_order: 1,
      seo: { title: "Best Software Development Course for University Students - 2026 | iCET", description: "iCM is the premier Software Development Course for University Students in Sri Lanka, designed so undergraduates build practical, job-ready engineering skills alongside their degree.", faq_group_slug: "icm" },
      content: {
        intake: "September 2026", brochure_label: "Programme brochure",
        entry_requirements: ["O/L with Maths (C) and English (S)", "A/L students (any stream)", "Undergraduates & graduates"],
        compare: { entry: "After O/L or A/L · undergraduates", ideal_for: "University students, school leavers, career switchers", technologies: "Java, MySQL, JavaScript/TypeScript, HTML5/CSS3, Tailwind, Spring Boot, Angular, Git", fee: "LKR 125,000 (LKR 100,000 one-time)" },
        highlights: [{ icon: "Clock", label: "Duration", value: "6 months · 3 levels" }, { icon: "GraduationCap", label: "Entry", value: "After O/L or A/L" }, { icon: "MonitorSmartphone", label: "Mode", value: "Online / Physical / Hybrid" }, { icon: "ShieldCheck", label: "Recognition", value: "TVEC Registered P03/0177" }],
        blocks: [
          { id: bid(), type: "anchor_nav", settings: {}, data: { items: [{ label: "Who it's for", anchor: "who" }, { label: "Curriculum", anchor: "curriculum" }, { label: "Fees", anchor: "fees" }, { label: "Stories", anchor: "stories" }, { label: "FAQ", anchor: "faq" }], cta: { label: "Apply now", href: "/apply?program=iCM" } } },
          { id: bid(), type: "features", settings: { tone: "white", anchor: "who" }, data: { eyebrow: "Who it's for", title: "Built first for university students — open to every beginning", description: "iCM runs alongside a degree rather than replacing one. No prior programming experience is required.", columns: 4, style: "cards", items: [
            { icon: "GraduationCap", title: "Undergraduates", description: "Build industry-ready software development skills alongside your degree, at any university in Sri Lanka." },
            { icon: "School", title: "School leavers", description: "Any stream — explore a software engineering career before choosing a degree path." },
            { icon: "Briefcase", title: "Job seekers", description: "Anyone preparing for a Software Engineer, Full Stack Developer or Associate Engineer role." },
            { icon: "Repeat", title: "Career switchers", description: "Non-IT graduates and professionals moving into software development from any field." },
          ] } },
          { id: bid(), type: "split", settings: { tone: "light" }, data: { eyebrow: "About iCM", title: "What is the iCM Software Development Course?", image: { url: campus("9x2a4450.jpg") || icm!, alt: "iCM students" }, image_side: "right", body: "<p>The iCM (iCET Certified Master) is a software development course for university students in Sri Lanka, built to run alongside a degree rather than replace one. It is also open to school leavers, non-IT professionals and aspiring software engineers who want practical, job-ready skills.</p><p>Through a hands-on curriculum, the course takes students from programming fundamentals through to modern software development practices, supported by project-based learning, real-world assignments and exposure to current industry technologies.</p><p>Combining technical training, career guidance and industry exposure, iCM helps learners build confidence, strengthen practical expertise and prepare for advanced software engineering studies, internships and full-time roles.</p>", bullets: [{ icon: "Code2", title: "Programming, databases & web", text: "Java, MySQL, JavaScript, HTML/CSS and more." }, { icon: "Users", title: "Mentorship from working engineers", text: "Lecturers who practise what they teach." }, { icon: "Clock", title: "Fits a university timetable", text: "Flexible online, physical and hybrid modes." }, { icon: "Trophy", title: "Industry-ready portfolio", text: "Real assignments and project work." }] } },
          { id: bid(), type: "curriculum", settings: { tone: "white", anchor: "curriculum" }, data: { eyebrow: "The iCM certification roadmap", title: "Three progressive levels", description: "From core programming fundamentals to enterprise-level application development, designed to slot alongside a university timetable.", style: "roadmap", levels: [
            { title: "Level 1 · Foundations", duration: "2 months", modules: ["Programming Fundamentals", "Business Process Management", "Database Management System"] },
            { title: "Level 2 · Core software engineering", duration: "2 months", modules: ["Object-Oriented Programming", "Data Structures and Algorithms", "Internet Technologies", "Software Engineering", "Object-Oriented Analysis and Design", "UI/UX Engineering"] },
            { title: "Level 3 · Advanced & applied development", duration: "2 months", modules: ["Advanced API Development", "Advanced Data Management Systems", "Rapid Application Development", "Software Development Project", "Enterprise Application Development"] },
          ], note: "By the end of all three levels you complete this course as an industry-ready full-stack developer, capable of contributing to enterprise-scale software projects.", cta: { label: "Apply now", href: "/apply?program=iCM" } } },
          { id: bid(), type: "pricing", settings: { tone: "light", anchor: "fees" }, data: { eyebrow: "Payment plans", title: "One total fee, two ways to pay", description: "Total course fee is LKR 125,000. Choose the payment structure that works best for you.", groups: [{ title: "", plans: [
            { name: "Option 1 · One-time payment", badge: "Best value", highlight: true, original_price: "LKR 125,000", price: "LKR 100,000", period: "paid before commencement", description: "Pay the full fee in one payment and receive a 20% offer.", features: ["Special offer (20%): −LKR 25,000", "Total payment LKR 100,000", "Valid for the specified period. Terms & conditions apply."], cta: { label: "Enroll with Option 1", href: "/apply?program=iCM" } },
            { name: "Option 2 · Installment plan", description: "Full fee spread across three installments.", installments: [{ label: "1st installment (before commencement)", amount: "LKR 60,000" }, { label: "2nd installment (30 days)", amount: "LKR 35,000" }, { label: "3rd installment (60 days)", amount: "LKR 35,000" }], total: "LKR 125,000", cta: { label: "Enroll with Option 2", href: "/apply?program=iCM" } },
          ] }], note: "Option 1 offers the lowest total cost. Installment plans let you start with a lower upfront payment. Contact your student counsellor for current offer terms." } },
          { id: bid(), type: "videos", settings: { tone: "white", anchor: "stories" }, data: { eyebrow: "Student stories", title: "Hear from learners who completed iCM", description: "At iCET the iCM programme helps students build confidence, gain practical industry exposure and develop software engineering skills from beginner to advanced level.", collection: "testimonials_icm", layout: "featured", limit: 7 } },
          { id: bid(), type: "faq", settings: { tone: "light", anchor: "faq" }, data: { eyebrow: "Common questions", title: "About the iCM software development course", group_slug: "icm", layout: "two-column", cta: { label: "Ask a counsellor", href: "/contact-us", variant: "outline" } } },
          { id: bid(), type: "steps", settings: { tone: "white" }, data: { ...STEPS_REGISTER, title: "Four steps to your first day", cta: { label: "Begin your application", href: "/apply?program=iCM" } } },
          { id: bid(), type: "cta", settings: { tone: "navy" }, data: PROGRAM_CTA("iCM") },
        ],
      },
    },
    {
      code: "iCD", slug: "icet-certified-developer", name: "iCET Certified Developer", qualification: "Diploma in Software Engineering",
      tagline: "Got your A/L results? iCD is iCET's one-year professional Software Engineering Diploma — designed to take you from results day to a software industry role, with 6 months of industry training built into the programme.",
      summary: "Industry-focused, one-year diploma providing a direct pathway into the software engineering field through structured, hands-on training and a 6-month industrial placement.",
      level_label: "PROFESSIONAL DIPLOMA · TVEC-ALIGNED · AFTER A/L", duration: "1 year (4 levels)", training: "6-month industrial training", mode: "Full-time weekdays or part-time weekends · Online / Physical / Hybrid",
      logo_url: icd, fee_from: 200000, accent: "#046bd2", sort_order: 2,
      seo: { title: "Software Engineering Course After A/L – iCET Certified Developer (Diploma)", description: "iCD is iCET's one-year, TVEC-registered Software Engineering Diploma for A/L leavers, graduates and career switchers, with 6 months of industry training built in.", faq_group_slug: "icd" },
      content: {
        intake: "September 2026 (weekday & weekend batches)", brochure_label: "Programme brochure",
        entry_requirements: ["A/L graduates (3 passes, Maths C / English S)", "O/L leavers via foundation programme", "IT and non-IT graduates", "Career switchers"],
        compare: { entry: "After A/L (or O/L + foundation)", ideal_for: "School leavers, graduates, career switchers", technologies: "Java, Spring Boot, Angular, MySQL, AWS/Azure, Mobile, Agentic AI (Copilot, Cursor, n8n)", fee: "LKR 225,000 full-time · LKR 200,000 part-time" },
        highlights: [{ icon: "Clock", label: "Duration", value: "1 year · 4 levels" }, { icon: "Briefcase", label: "Industrial training", value: "6 months" }, { icon: "GraduationCap", label: "Entry", value: "After A/L · no experience needed" }, { icon: "ShieldCheck", label: "Recognition", value: "TVEC Registered P03/0177" }],
        blocks: [
          { id: bid(), type: "anchor_nav", settings: {}, data: { items: [{ label: "Who it's for", anchor: "who" }, { label: "Curriculum", anchor: "curriculum" }, { label: "Fees", anchor: "fees" }, { label: "Outcomes", anchor: "outcomes" }, { label: "FAQ", anchor: "faq" }], cta: { label: "Apply now", href: "/apply?program=iCD" } } },
          { id: bid(), type: "features", settings: { tone: "white", anchor: "who" }, data: { eyebrow: "Who it's for", title: "Designed for students starting right after A/L", description: "The iCD full-time batch pairs structured software engineering training with essential soft-skills development. It's also open to IT and non-IT graduates ready to launch a software career.", columns: 4, style: "cards", items: [
            { icon: "GraduationCap", title: "After A/L students", description: "Start your software engineering career straight from results day — any stream welcome." },
            { icon: "School", title: "After O/L students", description: "Ready to start even earlier? Join with a foundation programme equivalent to G.C.E. A/Ls. No prior programming experience needed." },
            { icon: "Laptop", title: "IT undergraduates & graduates", description: "Sharpen practical, industry-ready skills with real enterprise projects and placement." },
            { icon: "Repeat", title: "Non-IT graduates & career switchers", description: "Move into software development from any field with structured, mentored training." },
          ] } },
          { id: bid(), type: "curriculum", settings: { tone: "light", anchor: "curriculum" }, data: { eyebrow: "Curriculum", title: "Four levels, foundations to AI-native development", description: "A carefully structured curriculum bridging fundamental coding paradigms to building advanced AI-agent ecosystems.", style: "roadmap", levels: [
            { title: "Level I · Programming Fundamentals", modules: ["Programming Fundamentals", "Business Process Management", "Database Management System"] },
            { title: "Level II · Object-Oriented Development & Web Foundations", modules: ["Object-Oriented Programming", "Data Structures and Algorithms", "Internet Technologies", "Software Engineering", "Object-Oriented Analysis and Design", "UI/UX Engineering"] },
            { title: "Level III · Advanced API & Enterprise Development", modules: ["Advanced API Development", "Advanced Data Management Systems", "Rapid Application Development", "Software Development Project", "Enterprise Application Development I"] },
            { title: "Level IV · Mobile, Cloud & Agentic AI Development", modules: ["Enterprise Application Development II", "Mobile Applications Development", "Software Project Management", "Applied Mathematics for AI", "Data Structures & Algorithms for AI Systems", "AI-Based Feature Development", "AI Agentic Development", "Cloud Architecture and Services", "IT and Entrepreneurship", "Professional Software Project (Research)"] },
          ], note: "iCD is a TVEC-registered (Reg. No. P03/0177) Software Engineering Diploma where Level IV goes beyond traditional software engineering into agentic AI development — working directly with tools like GitHub Copilot, Cursor and n8n.", cta: { label: "Apply now", href: "/apply?program=iCD" } } },
          { id: bid(), type: "pricing", settings: { tone: "white", anchor: "fees" }, data: { eyebrow: "Payment plans", title: "One programme, two learning modes, flexible payment", description: "Choose full-time or part-time study, then the payment structure that works best for you. Contact your student counsellor for current offers.", groups: [
            { title: "Full-time diploma (weekdays)", subtitle: "Full course fee LKR 225,000", plans: [
              { name: "Early bird offer", badge: "Limited time", original_price: "LKR 225,000", price: "LKR 150,000", period: "one-time payment", note: "Valid for the specified period. Terms & conditions apply.", cta: { label: "Enroll with Plan 01", href: "/apply?program=iCD" } },
              { name: "20% discount", highlight: true, original_price: "LKR 225,000", price: "LKR 180,000", period: "one-time payment", note: "Valid for the specified period. Terms & conditions apply.", cta: { label: "Enroll with Plan 01", href: "/apply?program=iCD" } },
              { name: "Installment plan", description: "Spread the full fee over the first months of study.", installments: [{ label: "Before orientation", amount: "LKR 100,000" }, { label: "Within 30 days", amount: "LKR 50,000" }, { label: "Within 60 days", amount: "LKR 50,000" }, { label: "Within 90 days", amount: "LKR 25,000" }], total: "LKR 225,000", cta: { label: "Enroll with Plan 02", href: "/apply?program=iCD" } },
            ] },
            { title: "Part-time diploma (weekends)", subtitle: "Full course fee LKR 200,000", plans: [
              { name: "Early bird offer", badge: "Limited time", original_price: "LKR 200,000", price: "LKR 150,000", period: "one-time payment", cta: { label: "Enroll with Plan 01", href: "/apply?program=iCD" } },
              { name: "20% discount", highlight: true, original_price: "LKR 200,000", price: "LKR 160,000", period: "one-time payment", note: "Valid for the specified period. Terms & conditions apply.", cta: { label: "Enroll with Plan 01", href: "/apply?program=iCD" } },
              { name: "Installment plan", installments: [{ label: "Before orientation", amount: "LKR 100,000" }, { label: "Within 30 days", amount: "LKR 50,000" }, { label: "Within 60 days", amount: "LKR 50,000" }], total: "LKR 200,000", cta: { label: "Enroll with Plan 02", href: "/apply?program=iCD" } },
            ] },
          ] } },
          { id: bid(), type: "split", settings: { tone: "light" }, data: { eyebrow: "iCD programme details", title: "The best software engineering course after A/L", image: { url: campus("9x2a4198.jpg") || icd!, alt: "iCD students at the iCET campus" }, image_side: "left", badge: "Since 2004", body: "<p>The iCD – iCET Certified Developer programme is a comprehensive one-year professional Software Engineering diploma designed for IT and non-IT graduates, and for school leavers ready to launch their career right after A/L or O/L results.</p><p>Built on an industry-oriented curriculum, iCD features an intensive six-month industrial training component, giving students direct, hands-on exposure to real-world software development environments. Through project-based learning and cutting-edge technologies, the programme builds strong analytical, problem-solving and software design capabilities.</p><p>Flexible learning options — online and physical — are supported by advanced virtual platforms and fully equipped labs, all guided by industry professionals with decades of combined experience.</p>", stats: [{ value: "1 yr", label: "Programme length" }, { value: "6 mo", label: "Industrial training" }, { value: "4", label: "Progressive levels" }] } },
          { id: bid(), type: "videos", settings: { tone: "white" }, data: { eyebrow: "Student testimonials", title: "Stories from iCD graduates", collection: "testimonials_icd", layout: "featured", limit: 7 } },
          { id: bid(), type: "quote", settings: { tone: "light" }, data: { eyebrow: "From the Director of Professional Training", quote: "Software engineering in Sri Lanka provides a pathway to a globally impactful career, enabling you to contribute to the world from your own local setting.", name: "Frank Cronemberg", role: "Director of Professional Training and Certification · Snr. Engineering Lead / Manager – CRM, Dialog Axiata PLC", meta: "MSc (Data Science), MSc (SE), MBCS (UK), RITTech", image: frank ? { url: frank, alt: "Frank Cronemberg" } : undefined } },
          { id: bid(), type: "features", settings: { tone: "white", anchor: "outcomes" }, data: { eyebrow: "Outcomes", title: "What you leave iCD with", description: "Every part of the course is designed toward one thing: being genuinely ready for a first software engineering role — not just certified.", columns: 4, style: "numbered", items: [
            { title: "Industry-level projects", description: "Real project experience with enterprise technologies and team workflows." },
            { title: "Job-ready soft skills", description: "Communication, teamwork and professional practice built into every level." },
            { title: "Career guidance & mentorship", description: "Interview preparation, CV reviews and placement support from the industry team." },
            { title: "Employer-ready portfolio", description: "A body of practical work, including AI-integrated projects, that demonstrates real capability from day one." },
          ] } },
          { id: bid(), type: "faq", settings: { tone: "light", anchor: "faq" }, data: { eyebrow: "Common questions", title: "About the iCD software engineer course after A/L", group_slug: "icd", layout: "two-column", cta: { label: "Ask a counsellor", href: "/contact-us", variant: "outline" } } },
          { id: bid(), type: "steps", settings: { tone: "white" }, data: { ...STEPS_REGISTER, cta: { label: "Begin your application", href: "/apply?program=iCD" } } },
          { id: bid(), type: "cta", settings: { tone: "navy" }, data: PROGRAM_CTA("iCD") },
        ],
      },
    },
    {
      code: "iCP", slug: "icet-certified-professionals", name: "iCET Certified Professional", qualification: "Higher Diploma in Computer Engineering with Applied Artificial Intelligence",
      tagline: "A two-year, full-time advanced programme that combines software engineering with applied AI and a one-year industry internship to prepare you for a successful tech career.",
      summary: "Comprehensive two-year Higher Diploma in Computer Engineering with Applied AI offering a direct pathway to the IT industry through structured, industry-aligned training and a full-year internship.",
      level_label: "HIGHER DIPLOMA · 24 MONTHS · APPLIED AI", duration: "2 years (6 levels)", training: "12-month industry internship", mode: "Full-time · Online / Physical / Hybrid",
      logo_url: icp, fee_from: 450000, accent: "#7c3aed", sort_order: 3,
      seo: { title: "Higher Diploma in Computer Engineering with Applied AI – iCET Certified Professional", description: "iCP is a two-year Higher Diploma combining advanced software engineering, AI & machine learning, cloud computing and a full 1-year industry internship — the longest in Sri Lanka.", faq_group_slug: "general" },
      content: {
        intake: "September 2026", brochure_label: "Programme brochure",
        entry_requirements: ["A/L students (Physical Science / Maths stream recommended)", "Students seeking a degree-equivalent CS/SE qualification"],
        compare: { entry: "After A/L", ideal_for: "A/L leavers wanting a degree-equivalent qualification in AI & software engineering", technologies: "Advanced SE, Applied AI/ML, Deep Learning, Cloud (AWS/Azure), Docker, Kubernetes, DevOps, Mobile", fee: "LKR 450,000 (two years)" },
        highlights: [{ icon: "Clock", label: "Duration", value: "2 years · 6 levels" }, { icon: "Briefcase", label: "Industry internship", value: "12 months" }, { icon: "BrainCircuit", label: "Specialisation", value: "Applied AI & Machine Learning" }, { icon: "ShieldCheck", label: "Recognition", value: "TVEC Registered P03/0177" }],
        blocks: [
          { id: bid(), type: "anchor_nav", settings: {}, data: { items: [{ label: "Experience", anchor: "experience" }, { label: "Curriculum", anchor: "curriculum" }, { label: "Internship", anchor: "internship" }, { label: "Fees", anchor: "fees" }, { label: "Stories", anchor: "stories" }], cta: { label: "Apply now", href: "/apply?program=iCP" } } },
          { id: bid(), type: "features", settings: { tone: "white", anchor: "experience" }, data: { eyebrow: "The iCP experience", title: "Two years. One complete journey from student to software professional.", columns: 4, style: "cards", items: [
            { icon: "Code2", title: "Advanced software engineering", description: "Master modern software engineering principles and build scalable applications." },
            { icon: "BrainCircuit", title: "Applied AI & machine learning", description: "Learn and implement AI and machine learning in real-world applications." },
            { icon: "Cloud", title: "Cloud & modern infrastructure", description: "Work with cloud platforms, containers and modern infrastructure technologies." },
            { icon: "Briefcase", title: "1-year industry experience", description: "Apply your skills through a full-year industry internship and grow your career." },
          ] } },
          { id: bid(), type: "curriculum", settings: { tone: "light", anchor: "curriculum" }, data: { eyebrow: "Curriculum", title: "Six levels: foundations to AI-native development", description: "A carefully structured curriculum bridging fundamental coding paradigms to advanced AI-agent ecosystems.", style: "grid", levels: [
            { title: "Level 1 · Programming Fundamentals", modules: ["Programming Fundamentals", "Business Process Management", "Database Management System", "Computer System and Architecture", "Mathematics and Discrete Structures for Computing"] },
            { title: "Level 2 · Object-Oriented & Advanced Programming", modules: ["Object-Oriented Programming", "Data Structures and Algorithms", "Advanced Database System", "Software Engineering"] },
            { title: "Level 3 · Web Design, Web & Mobile Application Development", modules: ["Web Design and Front-End Development", "Server-Side Web Development", "Mobile Application Development", "User Experience (UX) and Interface Design"] },
            { title: "Level 4 · Enterprise Engineering, Applications & Cloud Computing", modules: ["Enterprise Application Development", "Cloud Computing Fundamentals and Architecture", "DevOps and Continuous Delivery (CI/CD)", "Distributed Systems and Cybersecurity"] },
            { title: "Level 5 · Artificial Intelligence & Machine Learning", modules: ["Foundations of Artificial Intelligence", "Machine Learning Fundamentals", "Data Mining and Big Data Analytics", "AI Ethics, Governance, and Applied Systems", "Neural Networks and Deep Learning Foundations"] },
            { title: "Level 6 · Deep Learning, Generative AI & Research", modules: ["Convolutional Neural Networks and Computer Vision", "Natural Language Processing and Sequence Models", "Advanced Deep Learning, Generative AI, and Capstone Project", "Research Project"] },
          ], cta: { label: "Apply now", href: "/apply?program=iCP" } } },
          { id: bid(), type: "steps", settings: { tone: "white" }, data: { eyebrow: "Your journey", title: "From foundations to industry", layout: "horizontal", numbered: true, items: [{ title: "Foundations", description: "Programming, mathematics and computer systems." }, { title: "Engineering", description: "Object-oriented, web, mobile and enterprise development." }, { title: "Specialisation", description: "Applied AI, machine learning, deep learning and generative AI." }, { title: "Industry", description: "A full 12-month internship with partner companies." }] } },
          { id: bid(), type: "split", settings: { tone: "navy", anchor: "internship" }, data: { eyebrow: "1 year industry experience", title: "12 months of real industry exposure — the longest internship in Sri Lanka", image: { url: campus("9x2a7591.jpg") || icp!, alt: "iCP students" }, image_side: "right", body: "<p>The iCP programme includes 12 months of industry internship to help you gain real exposure and become career-ready before you graduate.</p>", bullets: [{ icon: "BookOpen", title: "Classroom knowledge", text: "Strong academic foundation" }, { icon: "Layers", title: "Real projects", text: "Work on industry projects" }, { icon: "Briefcase", title: "Industry internship", text: "12 months professional exposure" }, { icon: "Rocket", title: "Career ready", text: "Build your future with confidence" }], ctas: [{ label: "Industry placement programme", href: "/industry-placement", variant: "white" }] } },
          { id: bid(), type: "pricing", settings: { tone: "light", anchor: "fees" }, data: { eyebrow: "Payment plans", title: "One programme, flexible payment", description: "Full-time Higher Diploma · standard fee LKR 450,000 for two years. Contact your student counsellor for current offers.", groups: [{ title: "Full-time Higher Diploma", subtitle: "Standard fee LKR 450,000", plans: [
            { name: "Plan 01 · Yearly one-time payment", badge: "20% offer", highlight: true, original_price: "LKR 450,000", price: "LKR 360,000", period: "two payments of LKR 180,000", description: "Pay each year up front and save LKR 90,000 in total.", features: ["First year one-time: LKR 180,000", "Second year one-time: LKR 180,000", "Total saving −LKR 90,000"], cta: { label: "Enroll with Plan 01", href: "/apply?program=iCP" } },
            { name: "Plan 02 · First year installments + second year one-time", description: "Spread the first year, then save 20% on the second.", installments: [{ label: "Before orientation", amount: "LKR 100,000" }, { label: "Within 30 days", amount: "LKR 50,000" }, { label: "Within 60 days", amount: "LKR 40,000" }, { label: "Within 90 days", amount: "LKR 35,000" }, { label: "Second year (one-time, 20% off)", amount: "LKR 180,000" }], total: "LKR 405,000", cta: { label: "Enroll with Plan 02", href: "/apply?program=iCP" } },
            { name: "Plan 03 · Installments both years", description: "Four installments in each year.", installments: [{ label: "Year 1: before orientation", amount: "LKR 100,000" }, { label: "Year 1: within 30 / 60 / 90 days", amount: "LKR 50,000 / 40,000 / 35,000" }, { label: "Year 2: same schedule", amount: "LKR 225,000" }], total: "LKR 450,000", cta: { label: "Enroll with Plan 03", href: "/apply?program=iCP" } },
          ] }] } },
          { id: bid(), type: "split", settings: { tone: "white" }, data: { eyebrow: "iCP programme details", title: "Higher Diploma in Computer Engineering with Applied AI", image: { url: icp!, alt: "iCP" }, image_side: "left", body: "<p>The iCET Certified Professional (iCP) is a two-year Higher Diploma designed to build strong skills in software engineering, artificial intelligence, machine learning and cloud computing through practical, industry-focused learning.</p>", stats: [{ value: "2 yrs", label: "Programme length" }, { value: "12 mo", label: "Industrial training" }, { value: "6", label: "Progressive levels" }] } },
          { id: bid(), type: "videos", settings: { tone: "light", anchor: "stories" }, data: { eyebrow: "Student testimonials", title: "Stories from iCP students", collection: "testimonials_icp", layout: "featured", limit: 7 } },
          { id: bid(), type: "steps", settings: { tone: "white" }, data: { ...STEPS_REGISTER, cta: { label: "Begin your application", href: "/apply?program=iCP" } } },
          { id: bid(), type: "cta", settings: { tone: "navy" }, data: PROGRAM_CTA("iCP") },
        ],
      },
    },
  ];
  for (const p of programs) {
    await sql`insert into public.programs (code, slug, name, qualification, tagline, summary, level_label, duration, training, mode, logo_url, fee_from, accent, sort_order, seo, content, is_active)
      values (${p.code}, ${p.slug}, ${p.name}, ${p.qualification}, ${p.tagline}, ${p.summary}, ${p.level_label}, ${p.duration}, ${p.training}, ${p.mode}, ${p.logo_url}, ${p.fee_from}, ${p.accent}, ${p.sort_order}, ${sql.json(p.seo as never)}, ${sql.json(p.content as never)}, true)
      on conflict (code) do update set slug = excluded.slug, name = excluded.name, qualification = excluded.qualification, tagline = excluded.tagline, summary = excluded.summary, level_label = excluded.level_label, duration = excluded.duration, training = excluded.training, mode = excluded.mode, logo_url = excluded.logo_url, fee_from = excluded.fee_from, accent = excluded.accent, sort_order = excluded.sort_order, seo = excluded.seo, content = excluded.content`;
  }
  console.log("programs ✓");
}

/* ───────────────────────── Trainers / testimonials / partners ───────────────────────── */
async function seedPeople() {
  const trainers = [
    ["Dr. Niroth Samarawickrama", "Founder & Chief Executive, iCET", "PhD · 20+ years in software engineering & education", "niroth@icet.lk", "2026/06/Niroth-sir.png", true, "With over 20 years of expertise in this field, I am honoured to lead the Institute of Computer Engineering Technology (iCET), an institution dedicated to aligning student skills with the dynamic demands of the IT industry. Our programmes bridge the gap between theory and practical application, continuously updated to reflect industry standards. iCET's mission goes beyond academic excellence — we nurture Sri Lanka's young talent, transforming them into industry-ready software engineers. Our comprehensive training, combining technical expertise and hands-on experience, ensures that iCET graduates are not only job-ready but equipped to excel in the competitive software engineering field."],
    ["Frank Cronemberg", "Director of Professional Training & Certification · Snr. Engineering Lead / Manager – CRM, Dialog Axiata PLC", "MSc (Data Science), MSc (SE), MBCS (UK), RITTech", "frank@icet.lk", "2026/06/Frank-sir.png", false, "Software engineering in Sri Lanka provides a pathway to a globally impactful career, enabling you to contribute to the world from your own local setting."],
    ["Dinuka Kodithuwakku", "Senior Lecturer · Software Engineering", "", "dinuka@icet.lk", "2026/06/Dinuka-sir.png", false, ""],
    ["Dewmal Handapangoda", "Software Architect · AI Specialist · Senior Lecturer", "Founder of Syigen & Art of Intelligence", "dewmal@icet.lk", "2026/06/Dewmal-sir.png", false, ""],
    ["Udari Vithanage", "Lecturer · Software Engineering", "", "udari@icet.lk", "2026/06/Udari-Miss.png", false, ""],
    ["Sapumal Thepulangoda", "Lecturer · Software Engineering", "", "sapumal@icet.lk", "2026/06/Sapumal-sir.png", false, ""],
    ["Sachithra Geethanga", "Lecturer · Global Tech Careers", "", "sachithra@icet.lk", "2026/06/Sachithra-Sir.png", false, ""],
    ["Dulan Herath", "Software Engineer · Lecturer", "", "dulan@icet.lk", "2026/06/Dulan-Sir.png", false, ""],
    ["Sharada Marasinghe", "Lecturer · Full-Stack & Web Engineering", "", "sharada@icet.lk", "2026/06/Sharada-Sir.png", false, ""],
  ] as const;
  let i = 0;
  for (const [name, title, qual, email, photo, featured, bio] of trainers) {
    await sql`insert into public.trainers (slug, name, title, qualifications, bio, email, photo_url, is_featured, is_active, sort_order)
      values (${slugify(name)}, ${name}, ${title}, ${qual}, ${bio}, ${email}, ${await U(photo)}, ${featured}, true, ${i++})
      on conflict (slug) do update set name = excluded.name, title = excluded.title, qualifications = excluded.qualifications, bio = excluded.bio, email = excluded.email, photo_url = excluded.photo_url, is_featured = excluded.is_featured, sort_order = excluded.sort_order`;
  }
  const testimonials = [
    ["Vishodi Cooray", "Senior Software Engineer", "Hatchyard", "Thanks to Dr. Niroth's guidance, I transitioned from an Accounts Executive to a Senior Software Engineer, now enjoying a successful career with a premium salary. The iCET Training Program is an excellent opportunity for those looking to build a career in Software Engineering.", "2025/06/vishudi.jpg", "iCD"],
    ["Dilhan Nalaka Ariyarathna", "Lead Consultant", "Virtusa", "I highly recommend the iCET Institute to anyone truly committed to becoming a Software Engineer. As a former student of Dr. Niroth Samarawickrama in 2007, I am here today because of this solid foundation.", "2025/06/nalaka.jpg", "iCD"],
    ["Thusitha Dissanayake", "Associate Solution Architect", "Rezgateway", "The iCET Training program is invaluable for individuals pursuing a career in Software Engineering. As a 2008 student of Dr. Niroth Samarawickrama, his guidance and solid foundation were pivotal to my success in the industry.", "2025/06/thusitha.jpg", "iCD"],
    ["Sachithra Kaldera", "Tech Lead", "We Make Platforms", "I recommend iCET Institute for anyone pursuing a career in Software Engineering. As a 2008 student of Dr. Niroth Samarawickrama, his mentorship and solid foundation were crucial to my success in the industry.", "2025/06/sachithara.jpg", "iCD"],
    ["Athula Bandara", "IFS Technical Consultant", "Bitzify", "As a Physical Science graduate, entering the software industry just four months after joining the iCD program at iCET was made possible through its industry-focused training — ideal for anyone from a non-IT background.", "2025/06/athula.jpg", "iCD"],
  ] as const;
  await sql`delete from public.testimonials where name = any(${testimonials.map((t) => t[0])})`;
  i = 0;
  for (const [name, role, company, quote, photo, code] of testimonials) {
    await sql`insert into public.testimonials (name, role, company, quote, photo_url, program_code, rating, is_active, sort_order) values (${name}, ${role}, ${company}, ${quote}, ${await U(photo)}, ${code}, 5, true, ${i++})`;
  }
  const partnerNames = ["SimpliFy Labs", "Industry Partner 2", "Industry Partner 3", "Industry Partner 4", "Industry Partner 5", "Industry Partner 6", "Industry Partner 7"];
  await sql`delete from public.partners where category = 'industry' and name like 'Industry Partner %' or name = 'SimpliFy Labs'`;
  for (let k = 1; k <= 7; k++) {
    const logo = await U(`2025/07/${k}.png`);
    if (logo) await sql`insert into public.partners (name, logo_url, category, is_active, sort_order) values (${partnerNames[k - 1]}, ${logo}, 'industry', true, ${k})`;
  }
  console.log("trainers/testimonials/partners ✓");
}

/* ───────────────────────── FAQs ───────────────────────── */
async function seedFaqs() {
  const data = readJson<Record<string, { q: string; a: string }[]>>("faqs.json");
  data.programmes = [
    { q: "What is the best Professional IT Course in Sri Lanka?", a: "iCET offers Sri Lanka's most industry-aligned software engineering programmes — the iCM (Certificate), iCD (Diploma) and iCP (Higher Diploma with AI). All programmes include hands-on Java development, real project experience and direct industry connections built over 20+ years." },
    { q: "Can I study software engineering after O/Ls in Sri Lanka?", a: "Yes! iCET's iCM (Certificate in Software Development) is specifically designed for O/L graduates aged 14 and above. You only need to have passed your O/Ls with Maths (C) and English (S). No prior IT knowledge is required — we start from the basics." },
    { q: "Does iCET offer IT internships in Sri Lanka?", a: "Yes. iCET's iCD programme includes a 6-month IT internship and the iCP programme includes a full 1-year industry internship. Students work with real software companies on live projects as part of iCET's Industry Placement Programme." },
    { q: "Are there AI courses in Sri Lanka for beginners?", a: "iCET's iCP (Higher Diploma in Computer Engineering with Applied AI) covers Artificial Intelligence and Machine Learning as core subjects. It's designed for A/L graduates and anyone who wants to specialise in AI-powered software engineering in Sri Lanka." },
    { q: "What Java courses are available in Sri Lanka?", a: "All three iCET programmes include Java programming. The iCM covers Java fundamentals and Spring Boot. The iCD advances to enterprise Java and microservices. The iCP builds on these with AI-integrated Java applications." },
    { q: "How much does an IT course cost at iCET Sri Lanka?", a: "iCM is LKR 125,000, iCD is LKR 200,000–225,000 and iCP is LKR 450,000 over two years, with early-bird, one-time discount and installment options. Contact iCET at +94 705 805 805 for current fee structures." },
    { q: "Is iCET a government-recognised IT institute in Sri Lanka?", a: "Yes. iCET is registered with the Tertiary and Vocational Education Commission (TVEC), Registration No: P03/0177. This means iCET certificates are nationally recognised by employers and government institutions in Sri Lanka." },
    { q: "What is the difference between a software engineering degree and iCET's programmes?", a: "iCET's iCP (Higher Diploma) is considered a degree-equivalent qualification by many Sri Lankan employers. While it is not a university degree, it provides more industry-practical experience than most degree programmes, including a 1-year internship, Java enterprise development, AI training and direct job placement support." },
  ];
  const groups: Record<string, [string, string]> = { general: ["General questions", "Everything about studying at iCET"], icd: ["Common questions about iCD", "About the iCD software engineer course after A/L"], icm: ["Common questions about iCM", "About the iCM software development course"], programmes: ["Professional IT courses in Sri Lanka", "Frequently asked questions about our programmes"] };
  for (const [slug, [title, desc]] of Object.entries(groups)) {
    const g = await sql<{ id: string }[]>`insert into public.faq_groups (slug, title, description) values (${slug}, ${title}, ${desc}) on conflict (slug) do update set title = excluded.title, description = excluded.description returning id`;
    await sql`delete from public.faqs where group_id = ${g[0].id}`;
    let i = 0;
    for (const f of data[slug] || []) {
      const answer = f.a.includes("<") ? f.a : f.a.replace(/●/g, "<br>•").replace(/^(<br>)/, "");
      await sql`insert into public.faqs (group_id, question, answer, sort_order) values (${g[0].id}, ${f.q.trim()}, ${`<p>${answer}</p>`}, ${i++})`;
    }
  }
  console.log("faqs ✓");
}

/* ───────────────────────── Events & posts ───────────────────────── */
type WpEvent = { id: number; title: string; description: string; excerpt: string; start_date: string; end_date: string; all_day: boolean; venue: { venue?: string; address?: string } | unknown[]; image: { url: string } | false; categories: { name: string; slug: string }[]; cost: string; website: string; slug: string; modified: string };
async function seedEvents() {
  const data = readJson<{ events: WpEvent[] }>("events.json");
  const colors = ["#046bd2", "#16a34a", "#7c3aed", "#f59e0b", "#e11d48", "#0ea5e9", "#0f766e"];
  const catIds = new Map<string, number>();
  let c = 0;
  for (const e of data.events) for (const cat of e.categories || []) {
    if (catIds.has(cat.slug)) continue;
    const name = cat.name.replace(/ /g, " ");
    const r = await sql<{ id: number }[]>`insert into public.event_categories (slug, name, color) values (${cat.slug}, ${name}, ${colors[c++ % colors.length]}) on conflict (slug) do update set name = excluded.name returning id`;
    catIds.set(cat.slug, r[0].id);
  }
  for (const e of data.events) {
    const venue = Array.isArray(e.venue) ? {} : (e.venue as { venue?: string; address?: string });
    const content = await rewriteHtml(e.description || "");
    const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = e.title.replace(/&#8211;/g, "–").replace(/&#8217;/g, "’").replace(/&amp;/g, "&");
    const isOnline = /webinar|online/i.test(title + " " + text.slice(0, 200)) && !venue.venue;
    await sql`insert into public.events (slug, title, excerpt, content, start_at, end_at, all_day, venue, address, is_online, image_url, cost, registration_url, category_ids, status, seo)
      values (${e.slug}, ${title}, ${text.slice(0, 220)}, ${content}, ${e.start_date + "+05:30"}, ${e.end_date + "+05:30"}, ${!!e.all_day}, ${venue.venue || ""}, ${venue.address || ""}, ${isOnline}, ${e.image ? await U(e.image.url) : null}, ${e.cost || ""}, ${e.website || null}, ${(e.categories || []).map((x) => catIds.get(x.slug)!).filter(Boolean)}, 'published', '{}'::jsonb)
      on conflict (slug) do update set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content, start_at = excluded.start_at, end_at = excluded.end_at, venue = excluded.venue, image_url = excluded.image_url, category_ids = excluded.category_ids, cost = excluded.cost, registration_url = excluded.registration_url`;
  }
  console.log(`events ✓ (${data.events.length})`);

  type WpPost = { slug: string; title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string }; date: string; featured_media: number; categories: number[] };
  const posts = readJson<WpPost[]>("posts.json");
  const media = readJson<{ id: number; source_url: string }[]>("media.json");
  for (const slug of ["blockchain", "technology"]) await sql`insert into public.post_categories (slug, name) values (${slug}, ${slug.charAt(0).toUpperCase() + slug.slice(1)}) on conflict (slug) do nothing`;
  const pc = await sql<{ id: number; slug: string }[]>`select id, slug from public.post_categories`;
  for (const p of posts) {
    const content = await rewriteHtml(p.content.rendered);
    const cover = media.find((m) => m.id === p.featured_media)?.source_url;
    const words = content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const newSlug = p.slug === "blockchain-01" ? "blockchain-cryptocurrency-tokens-smart-contracts-nfts-dapps-web3-guide" : p.slug;
    await sql`insert into public.posts (slug, title, excerpt, content, cover_image, author_name, author_title, author_photo, category_ids, tags, reading_minutes, status, published_at, seo)
      values (${newSlug}, ${p.title.rendered.replace(/&amp;/g, "&")}, ${p.excerpt.rendered.replace(/<[^>]+>/g, "").replace(/\[&hellip;\]/g, "…").trim()}, ${content}, ${cover ? await U(cover) : null}, 'Dewmal Handapangoda', 'Software Architect · AI Specialist · Senior Lecturer at iCET', ${await U("2026/06/Dewmal-sir.png")}, ${pc.map((x) => x.id)}, ${["Blockchain", "Web3", "Smart Contracts", "NFTs"]}, ${Math.max(3, Math.round(words / 200))}, 'published', ${p.date + "+05:30"}, ${sql.json({ description: "Blockchain, cryptocurrency, tokens, smart contracts, NFTs, dApps and Web3 explained simply by iCET senior lecturer Dewmal Handapangoda." } as never)})
      on conflict (slug) do update set content = excluded.content, cover_image = excluded.cover_image, excerpt = excluded.excerpt`;
  }
  console.log("posts ✓");
}

/* ───────────────────────── Gallery & videos ───────────────────────── */
async function seedGallery() {
  const albums = [
    { slug: "icet-awurudu-2025", title: "iCET Avurudu Celebration 2025", description: "A vibrant Avurudu day-out at Laya Beach filled with tradition, joy and togetherness.", date: "2025-04-11", files: Array.from({ length: 21 }, (_, i) => `2025/07/${i + 1}.jpg`) },
    { slug: "sathipasala-mindfulness-programme", title: "Sathipasala Mindfulness Programme", description: "Mindfulness session in collaboration with the Sathi Pasala Foundation.", date: "2026-09-10", files: Array.from({ length: 10 }, (_, i) => `2026/09/${i + 1}-scaled.png`) },
    { slug: "life-at-icet", title: "Life at iCET", description: "Moments from our Panadura campus, intakes and outings.", date: "2026-02-01", files: ["campus/9x2a4198.jpg", "campus/9x2a4329.jpg", "campus/9x2a4450.jpg", "campus/9x2a4478.jpg", "campus/9x2a5367.jpg", "campus/9x2a5605.jpg", "campus/9x2a5609.jpg", "campus/9x2a6548.jpg", "campus/9x2a7033.jpg", "campus/9x2a7591.jpg", "campus/9x2a7685.jpg", "campus/9x2a8306.jpg", "campus/9x2a8328.jpg", "campus/9x2a8423.jpg", "campus/9x2a9155.jpg"] },
  ];
  let order = 0;
  for (const a of albums) {
    const g = await sql<{ id: string }[]>`insert into public.gallery_albums (slug, title, description, event_date, is_active, sort_order) values (${a.slug}, ${a.title}, ${a.description}, ${a.date}, true, ${order++}) on conflict (slug) do update set title = excluded.title, description = excluded.description returning id`;
    await sql`delete from public.gallery_images where album_id = ${g[0].id}`;
    let i = 0;
    for (const f of a.files) {
      const row = f.startsWith("campus/") ? mediaByRel.get(f) : null;
      const url = row ? row.url : await U(f);
      if (!url || url.startsWith(WP)) continue;
      const m = row || mediaByRel.get(f.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1"));
      await sql`insert into public.gallery_images (album_id, url, alt, width, height, sort_order) values (${g[0].id}, ${url}, ${a.title}, ${m?.width ?? null}, ${m?.height ?? null}, ${i++})`;
    }
    const cover = await sql<{ url: string }[]>`select url from public.gallery_images where album_id = ${g[0].id} order by sort_order limit 1`;
    if (cover[0]) await sql`update public.gallery_albums set cover_url = ${cover[0].url} where id = ${g[0].id}`;
  }
  const yt = readJson<Record<string, { id: string; title: string | null; thumb: string | null }[]>>("youtube.json");
  await sql`delete from public.videos`;
  for (const [collection, list] of Object.entries(yt)) {
    let i = 0;
    for (const v of list) {
      await sql`insert into public.videos (title, youtube_id, thumbnail_url, collection, sort_order, is_active) values (${v.title || "iCET video"}, ${v.id}, ${v.thumb}, ${collection}, ${i++}, true)`;
    }
  }
  console.log("gallery/videos ✓");
}

/* ───────────────────────── Pages ───────────────────────── */
async function upsertPage(slug: string, title: string, blocks: unknown[], seo: Record<string, unknown>, template = "blocks") {
  await sql`insert into public.pages (slug, title, template, blocks, seo, status, show_in_search) values (${slug}, ${title}, ${template}, ${sql.json(blocks as never)}, ${sql.json(seo as never)}, 'published', ${!["icd-academic", "icp-academic", "feedback-form", "parent-feedback", "workshop-registration"].includes(slug)})
    on conflict (slug) do update set title = excluded.title, blocks = excluded.blocks, seo = excluded.seo, updated_at = now()`;
}

async function seedPages() {
  const hero = campus("9x2a4198.jpg");
  const heroAlt = campus("9x2a5367.jpg");
  const B = (type: string, data: Record<string, unknown>, settings: Record<string, unknown> = {}) => ({ id: bid(), type, settings, data });

  await upsertPage("home", "Home", [
    B("hero", { layout: "split", eyebrow: "Institute of Computer Engineering Technology · Since 2004", title: "Forge Your Career in", rotating: ["Software Engineering", "Applied AI", "Cloud Architecture", "Full-Stack Development"], subtitle: "Explore the premier software engineering courses in Sri Lanka at iCET — where innovative minds unlock real-world opportunities through industry-aligned programmes, expert lecturers and guaranteed industrial training.", primary_cta: { label: "Apply now", href: "/apply" }, secondary_cta: { label: "Explore programmes", href: "/professional-it-courses-in-sri-lanka", variant: "white" }, image: hero ? { url: hero, alt: "Students at the iCET campus in Panadura" } : undefined, badges: [{ icon: "ShieldCheck", label: "TVEC Registered P03/0177" }, { icon: "Briefcase", label: "6–12 month industry internships" }, { icon: "Users", label: "15,000+ alumni network" }], stats: [{ value: "20+", label: "Years of excellence" }, { value: "15,000+", label: "Professionals trained" }, { value: "1,000+", label: "Current students" }] }),
    B("features", { eyebrow: "Why iCET", title: "Industry-aligned education, from day one", description: "Everything we teach is shaped by what Sri Lanka's software industry needs next.", columns: 4, style: "cards", items: [
      { icon: "Layers", title: "Industry-aligned programmes", description: "Master full-stack development, applied AI and cloud architecture through specialised software engineering courses designed around current industry trends." },
      { icon: "Users", title: "Expert guidance", description: "Train with experienced software architects, tech leads and AI specialists who bring industry insights into the classroom." },
      { icon: "FlaskConical", title: "Research and innovation", description: "Practise engineering through research, pushing the boundaries of knowledge and transforming ideas into groundbreaking innovations." },
      { icon: "Handshake", title: "Industry partnerships", description: "Direct collaboration with tech leaders for internships, projects and placement opportunities." },
    ] }, { tone: "white" }),
    B("programs", { eyebrow: "Transformative learning paths", title: "Choose your programme", description: "Gain hands-on experience and industry-ready skills for a successful software engineering career — from O/L to Higher Diploma.", style: "cards", cta: { label: "Compare all programmes", href: "/professional-it-courses-in-sri-lanka", variant: "outline" } }, { tone: "light" }),
    B("split", { eyebrow: "Bridging education with industry excellence", title: "iCET Industry Placement", badge: "Established 2004", image: await img("2025/06/12.jpg", "iCET students with industry mentors"), image_side: "left", body: "<p>At iCET, our industry placement programme is more than a bridge between academia and the professional world — it's a launchpad for future-ready software engineers. We equip students with hands-on experience while connecting them with top-tier IT companies.</p>", bullets: [{ icon: "Globe2", title: "Global partnerships", text: "Partnering with leading IT companies worldwide" }, { icon: "BadgeCheck", title: "Workplace readiness", text: "Preparing students for real workplace dynamics" }, { icon: "Layers", title: "Scalable solutions", text: "Building scalable and sustainable software" }, { icon: "Target", title: "Business alignment", text: "Aligning technical skills with business objectives" }], ctas: [{ label: "Explore industry placement", href: "/industry-placement" }, { label: "Student success stories", href: "https://youtube.com/playlist?list=PLQ_hJ6PP4MemBh3FM_iOPJSZQJYh5QoWH", variant: "outline" }] }, { tone: "white" }),
    B("partners", { eyebrow: "Trusted by industry", title: "Our official industry partners", style: "marquee" }, { tone: "light" }),
    B("cards", { eyebrow: "Enrollment pathways", title: "Start your engineering journey", description: "Three simple ways to get personalised guidance and secure your seat.", columns: 3, style: "image-top", items: [
      { image: await img("2025/06/VirtualAppointments.png", "Virtual appointment"), title: "Virtual appointments", description: "Get personalised guidance through video calls or phone consultations from anywhere.", cta: { label: "Book a session", href: "/contact-us", variant: "outline" } },
      { image: await img("2025/06/OnlineApplication-1.jpg", "Online application"), title: "Online application", description: "Submit your application online to secure your seat and receive direct guidance via WhatsApp.", cta: { label: "Apply now", href: "/apply", variant: "primary" }, badge: "Fastest" },
      { image: await img("2025/06/inperson.png", "In-person appointment"), title: "In-person appointments", description: "Visit our Panadura institute for personalised guidance from academic administrators and student counsellors.", cta: { label: "Schedule a visit", href: "/contact-us", variant: "outline" } },
    ] }, { tone: "white" }),
    B("stats", { eyebrow: "Transforming tech education in Sri Lanka", title: "Two decades of measurable impact", description: "Quantifying our commitment to excellence in computer engineering education and industry preparation.", style: "cards", items: [{ icon: "Users", value: 15000, suffix: "+", label: "IT professionals trained" }, { icon: "Award", value: 20, suffix: "+", label: "Years of excellence" }, { icon: "GraduationCap", value: 1000, suffix: "+", label: "Current students" }, { icon: "Handshake", value: 50, suffix: "+", label: "Industry partners" }], cta: { label: "Explore our success stories", href: "/industry-placement", variant: "white" } }, { tone: "navy" }),
    B("testimonials", { eyebrow: "Alumni testimonials", title: "iCET student success stories", description: "Hear directly from our graduates about their transformative experiences.", layout: "carousel", limit: 8 }, { tone: "white" }),
    B("workshops", { eyebrow: "Register now", title: "Upcoming workshops & short courses", limit: 3 }, { tone: "light" }),
    B("events", { eyebrow: "Join our community", title: "Events, webinars & tech meetups", description: "Hosting impactful events and tech hackathons alongside the premier software engineering courses in Sri Lanka to ensure complete industry preparation.", layout: "grid", limit: 3, upcoming_only: false }, { tone: "white" }),
    B("posts", { eyebrow: "Insights", title: "Explore. Learn. Grow.", limit: 3 }, { tone: "light" }),
    B("cta", { style: "banner", eyebrow: "Admissions open", title: "Empowering the next generation of software engineers", description: "Join our professional programmes designed to equip you with the skills and knowledge to thrive in the tech industry. Start your journey with us today!", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Talk to a counsellor", href: "/contact-us", variant: "ghost" } }, { tone: "navy" }),
  ], { title: "Software Engineering Courses in Sri Lanka | iCET - Institute of Computer Engineering Technology", description: "Enroll in industry-aligned Software Engineering courses in Sri Lanka at iCET. Gain expert guidance, hands-on training, and real-world project experience.", keywords: ["software engineering courses sri lanka", "IT courses sri lanka", "diploma in software engineering", "higher diploma AI sri lanka", "iCET"] });

  await upsertPage("about", "About iCET", [
    B("page_hero", { eyebrow: "Shaping future tech leaders", title: "The legacy of iCET", subtitle: "Since 2004, Dr. Niroth Samarawickrama has been at the forefront of reshaping software engineering education, empowering students with the expertise required to succeed in the tech industry.", image: await img("2025/06/about.png", "iCET campus"), ctas: [{ label: "Explore programmes", href: "/professional-it-courses-in-sri-lanka" }, { label: "Meet our trainers", href: "/trainers", variant: "ghost" }] }),
    B("split", { eyebrow: "Transforming tech education since 2004", title: "Twenty years of pioneering software education", image: heroAlt ? { url: heroAlt, alt: "iCET students" } : await img("2025/06/about.png"), image_side: "right", body: "<p>Under Dr. Samarawickrama's leadership, many students are now in senior positions at leading global software companies, while others have founded successful businesses. His unwavering focus on innovation, hands-on learning and industry alignment continues to contribute significantly to the growth of Sri Lanka's IT sector.</p>", bullets: [{ icon: "Award", title: "20+ years of excellence", text: "Over two decades of pioneering software education expertise." }, { icon: "Users", title: "15,000+ IT professionals", text: "Empowering software engineering enthusiasts for the Sri Lankan ICT industry." }, { icon: "GraduationCap", title: "1,000+ active students", text: "Currently shaping the future of technology in our programmes." }, { icon: "Compass", title: "Journey at iCET", text: "From essential skills to career success — industry insight, innovation, competence and excellence." }] }, { tone: "white" }),
    B("quote", { eyebrow: "The guiding philosophy", title: "A message from our founder", quote: "Since 2004, my vision has been to bridge the gap between academia and industry through practical, future-focused education.", name: "Dr. Niroth Samarawickrama", role: "Founder & Chief Executive, iCET", meta: "20+ years in software engineering and education", image: await img("2026/06/Niroth-sir.png", "Dr. Niroth Samarawickrama"), sections: [{ title: "Transforming computer engineering education", text: "With over two decades of experience spanning both industry and academia, I established iCET to revolutionise how Sri Lanka develops its software engineering talent. Our mission goes beyond traditional education — we cultivate professionals who can immediately contribute to and lead in the global technology sector. Our curriculum emphasises practical, project-based learning to equip professionals for real-world technological challenges." }, { title: "Preparing for the AI era", text: "As artificial intelligence transforms our industry, we emphasise the enduring value of human creativity, critical thinking and complex problem-solving. Our graduates don't just learn current technologies — they develop the adaptability to master future innovations. Through leadership training, collaborative projects and continuous industry engagement, iCET students become the architects of Sri Lanka's digital future." }] }, { tone: "light" }),
    B("features", { eyebrow: "The Institute of Computer Engineering Technology", title: "A globally minded leader in software engineering education", description: "Our mission is to deliver industry-aligned programmes that combine academic excellence with real-world application, preparing students to excel in the ever-evolving tech landscape.", columns: 4, style: "cards", items: [{ icon: "Layers", title: "Industry-aligned curriculum", description: "Our programmes are built with top tech companies to ensure real-world relevance." }, { icon: "Users", title: "Expert faculty", description: "Learn from seasoned professionals with decades of industry and academic experience." }, { icon: "Briefcase", title: "Career support", description: "Dedicated placement assistance to help graduates secure top-tier tech roles." }, { icon: "Network", title: "Vibrant alumni network", description: "Join a thriving community of 15,000+ professionals shaping the future of tech." }] }, { tone: "white" }),
    B("features", { eyebrow: "Our mission and vision", title: "Why we exist", columns: 2, style: "cards", items: [{ icon: "Target", title: "Our mission", description: "To provide comprehensive software engineering education and industry-oriented training, equipping students with the technical expertise, practical experience and professional competence required for successful careers in the software industry." }, { icon: "Telescope", title: "Our vision", description: "To be the global software education sector leader, connecting individuals with the knowledge, skills and intelligence to excel in the software engineering industry." }] }, { tone: "navy" }),
    B("trainers", { eyebrow: "Faculty", title: "Learn from practising engineers", featured_only: false, show_bio: false, limit: 4, layout: "grid", cta: { label: "Meet the full panel", href: "/trainers", variant: "outline" } }, { tone: "light" }),
    B("cta", { style: "banner", title: "Start your software engineering journey with iCET", description: "Industry-aligned programmes, expert mentors and real internships since 2004.", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Contact us", href: "/contact-us", variant: "ghost" } }, { tone: "brand" }),
  ], { title: "About iCET – Institute of Computer Engineering Technology, Sri Lanka", description: "Since 2004, Dr. Niroth Samarawickrama has been at the forefront of reshaping software engineering education in Sri Lanka. Learn about iCET's legacy, mission and vision.", og_image: await U("2025/06/about.png") });

  await upsertPage("professional-it-courses-in-sri-lanka", "Professional Programmes", [
    B("page_hero", { eyebrow: "Professional IT courses in Sri Lanka", title: "Launch your tech career with Sri Lanka's #1 software engineering institute", subtitle: "Whether you're an O/L student, A/L graduate or working professional, our TVEC-registered programmes take you from zero to industry-ready — with real Java programming, AI & machine learning, full-stack development and guaranteed internship placements.", ctas: [{ label: "Apply now", href: "/apply" }, { label: "Compare programmes", href: "#compare", variant: "ghost" }] }),
    B("programs", { eyebrow: "Professional programmes", title: "Three pathways, one goal: industry readiness", description: "Comprehensive professional IT courses designed to bridge the gap between academia and industry demands.", style: "detailed" }, { tone: "white" }),
    B("features", { eyebrow: "Why iCET", title: "Why iCET is the best IT training institute in Sri Lanka", columns: 3, style: "cards", items: [
      { icon: "Award", title: "20+ years of industry experience", description: "Founded in 2004 by Dr. Niroth Samarawickrama, iCET has been Sri Lanka's trusted name in professional software engineering education for over two decades." },
      { icon: "Users", title: "15,000+ successful alumni", description: "Our graduates work at top companies across Sri Lanka and internationally." },
      { icon: "Briefcase", title: "Real IT internship guaranteed", description: "Every programme includes structured industry training — 6 months for iCD and a full year for iCP." },
      { icon: "Code2", title: "Industry-relevant curriculum", description: "Java, Spring Boot, Angular, Python, AI & ML, Cloud (AWS/Azure), Docker, Kubernetes and modern DevOps — tools actually used in Sri Lanka's IT industry." },
      { icon: "ShieldCheck", title: "TVEC government registered", description: "iCET is an officially registered institute (TVEC No: P03/0177), ensuring your certificate is nationally recognised and valued by employers." },
      { icon: "Clock", title: "Flexible learning options", description: "Weekday full-time, weekend part-time, online or hybrid formats — for school leavers, university students and working professionals aged 14–35." },
    ] }, { tone: "light" }),
    B("programs", { eyebrow: "Compare", title: "Compare programmes side by side", style: "compare" }, { tone: "white", anchor: "compare" }),
    B("steps", { eyebrow: "Admission process", title: "A streamlined journey to enrollment", description: "Start your educational experience with confidence.", layout: "horizontal", numbered: true, items: [{ title: "Online application", description: "Fill out our simple online form with your details, academic background and the programme you're interested in. Takes less than 5 minutes.", bullets: ["Personal information", "Academic records", "Statement of purpose"] }, { title: "Skills assessment", description: "A short online test covering logical reasoning and foundational knowledge. No prior IT experience needed for iCM or iCP.", bullets: ["Online test", "Logical reasoning", "Basic technical knowledge"] }, { title: "Online consultation", description: "A 20-minute call with a faculty member to understand your goals and suggest the right programme path.", bullets: ["Video conference", "Technical discussion", "Learning goals alignment"] }, { title: "Admission decision", description: "Receive your official decision within 2 business days, complete payment and receive your orientation schedule.", bullets: ["Notification within 2 days", "Payment process", "Orientation schedule"] }], cta: CTA_APPLY }, { tone: "light" }),
    B("faq", { eyebrow: "FAQ", title: "Frequently asked questions", group_slug: "programmes", layout: "accordion" }, { tone: "white" }),
    B("cta", { style: "card", title: "Not sure which programme fits you?", description: "Our counsellors will map your O/L, A/L or degree background to the right pathway in one call.", primary_cta: { label: "Talk to a counsellor", href: "/contact-us", variant: "white" }, secondary_cta: { label: "Apply now", href: "/apply", variant: "ghost" }, bullets: ["Free consultation", "Flexible payment plans", "Online, physical & hybrid"] }, { tone: "light" }),
  ], { title: "Best Professional IT Courses in Sri Lanka (2026) - iCET", description: "Discover the best Professional IT Courses in Sri Lanka at iCET. Industry-recognised software engineering and computer training with guaranteed internships to boost your career.", og_image: await U("2025/06/iCDlogo-scaled.png"), faq_group_slug: "programmes" });

  await upsertPage("industry-placement", "Industry Placement", [
    B("page_hero", { eyebrow: "Connecting professionals · iCET Alumni Association", title: "Bridge between academia and industry", subtitle: "Empowering skills for industry success. Align academic knowledge with industry requirements through immersive professional experiences — practical training, industry partnerships and proven career growth.", image: await img("2025/06/vishudi.jpg", "iCET alumni"), ctas: [{ label: "Apply now", href: "/apply" }, { label: "Partner with us", href: "/contact-us", variant: "ghost" }] }),
    B("features", { columns: 3, style: "icon-left", items: [{ icon: "Wrench", title: "Practical training", description: "Real-world project experience" }, { icon: "Handshake", title: "Industry partnerships", description: "Direct collaboration with leading companies" }, { icon: "TrendingUp", title: "Career growth", description: "Proven employment outcomes" }] }, { tone: "white", size: "sm" }),
    B("split", { eyebrow: "Established 2004", title: "About the iCET Alumni", badge: "15,000+ network", image: await img("2025/06/12.jpg", "iCET alumni"), image_side: "left", body: "<p>Since 2004, under the visionary guidance of Dr. Niroth Samarawickrama, iCET has been a driving force in shaping IT professionals. With a legacy of over 15,000 trained students, iCET has played a vital role in shaping the careers of many who now thrive in top-tier tech companies, startups and entrepreneurial ventures.</p><p>The Alumni Association highlights these success stories, inspires current students and strengthens ties between accomplished graduates and the institute through exclusive networking events, mentorship programmes and knowledge-sharing sessions.</p>", stats: [{ value: "15,000+", label: "Alumni" }, { value: "2004", label: "Established" }], ctas: [{ label: "Connect with 15,000+ professionals", href: "https://www.linkedin.com/company/icetsrilanka", variant: "outline" }] }, { tone: "light" }),
    B("features", { eyebrow: "Industry training", title: "Empowering skills for industry success", description: "Students are equipped with practical skills and real-world experience, aligning academic knowledge with industry requirements in a professional work environment.", columns: 3, style: "cards", items: [{ icon: "Laptop", title: "Real-world experience", description: "Work on live projects with industry mentors." }, { icon: "BadgeCheck", title: "Career readiness", description: "Develop in-demand skills and build a professional portfolio." }, { icon: "Network", title: "Networking", description: "Connect with industry professionals and alumni." }, { icon: "Users", title: "Talent pipeline (for industry)", description: "Access to pre-trained, job-ready candidates." }, { icon: "Coins", title: "Cost efficiency (for industry)", description: "Reduce onboarding time and training costs." }, { icon: "Lightbulb", title: "Innovation (for industry)", description: "Collaborate with fresh talent on cutting-edge solutions." }] }, { tone: "white" }),
    B("features", { eyebrow: "Programme highlights", title: "Industry placement programme highlights", columns: 2, style: "numbered", items: [{ title: "Partnering with leading IT companies", description: "iCET partners with leading software companies to enhance our industrial training programme, offering students real-world exposure, continuous support and industry insights on emerging trends." }, { title: "Preparing for workplace dynamics", description: "Agile practices, structured planning and teamwork, with regular discussions that refine problem-solving and time management while fostering professionalism and accountability." }, { title: "Building scalable and sustainable software", description: "Cloud platforms like AWS and Azure, frameworks like Spring Boot and Node.js, tools like Docker and Kubernetes, git-based version control, microservices and RESTful APIs." }, { title: "Technical skills in business thinking", description: "Bridging technical skills and business thinking — market needs, client requirements, prioritising features, optimising resources and communicating with non-technical stakeholders." }], cta: { label: "Explore curriculum", href: "/professional-it-courses-in-sri-lanka", variant: "white" } }, { tone: "navy" }),
    B("videos", { eyebrow: "Experience sharing podcast series", title: "From learners to leaders: Industry Insight Tech Chat", description: "Conversations with Dr. Niroth's alumni about building careers in the software industry.", collection: "alumni_podcast", layout: "featured", limit: 8 }, { tone: "white" }),
    B("testimonials", { eyebrow: "Alumni testimonials", title: "Hear from our graduates", layout: "grid", limit: 6 }, { tone: "light" }),
    B("cta", { style: "banner", eyebrow: "Ready for industry success?", title: "Industry-recognised certification and hands-on project experience", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Life at iCET", href: "/student-life", variant: "ghost" }, bullets: ["Industry-recognised certifications", "Hands-on project experience", "6–12 month internships"] }, { tone: "brand" }),
  ], { title: "Industry Placement & Alumni Network – iCET Sri Lanka", description: "iCET's industry placement programme connects students with leading IT companies through 6–12 month internships, mentorship and a 15,000+ alumni network.", og_image: await U("2025/06/vishudi.jpg") });

  await upsertPage("student-life", "Student Life", [
    B("page_hero", { eyebrow: "Student life at iCET", title: "A vibrant life filled with learning, innovation and community", subtitle: "At iCET, we provide a holistic learning environment that goes beyond traditional classroom education — designed to foster creativity, collaboration and personal growth.", image: campus("9x2a7591.jpg") ? { url: campus("9x2a7591.jpg")!, alt: "iCET students beach clean-up" } : await img("2025/08/1-1.png"), ctas: [{ label: "Apply now", href: "/apply" }] }),
    B("split", { eyebrow: "Life at iCET Institute", title: "More than a classroom", image: campus("9x2a4450.jpg") ? { url: campus("9x2a4450.jpg")!, alt: "iCET campus" } : await img("2025/08/1-1.png"), image_side: "right", body: "<p>Our Panadura campus combines modern facilities with a close-knit community of tech enthusiasts. Experience life at iCET through our collection of memories and moments.</p>", bullets: [{ icon: "Building2", title: "Modern facilities" }, { icon: "Users", title: "Collaborative study areas" }, { icon: "Cpu", title: "State-of-the-art tech labs" }, { icon: "Coffee", title: "Recreation & relaxation zones" }] }, { tone: "white" }),
    B("gallery", { eyebrow: "Memories and moments", title: "Life at iCET in pictures", albums: ["life-at-icet"], layout: "masonry", limit: 12 }, { tone: "light" }),
    B("features", { eyebrow: "Student clubs & activities", title: "Join our vibrant community of tech enthusiasts and innovators", columns: 3, style: "cards", items: [{ icon: "Code2", title: "Coding Club", description: "Join fellow coding enthusiasts in hackathons, coding challenges and collaborative projects to sharpen your skills." }, { icon: "Lightbulb", title: "Innovation Hub", description: "Work on cutting-edge projects and participate in tech competitions with mentorship from industry leaders." }, { icon: "Network", title: "Tech Community", description: "Connect with industry professionals and tech enthusiasts through regular meetups, workshops and networking events." }] }, { tone: "white" }),
    B("gallery", { eyebrow: "iCET gallery", title: "iCET Avurudu & Sathipasala", description: "Celebrating culture, togetherness and mindfulness.", albums: ["icet-awurudu-2025", "sathipasala-mindfulness-programme"], layout: "carousel", limit: 30, cta: { label: "View all albums", href: "/student-life/gallery/icet-awurudu-2025", variant: "outline" } }, { tone: "light" }),
    B("videos", { eyebrow: "Video gallery", title: "Experience our institute through these videos", collection: "student_life", layout: "grid", limit: 6 }, { tone: "white" }),
    B("events", { eyebrow: "What's on", title: "Upcoming events & workshops", limit: 3, upcoming_only: false }, { tone: "light" }),
    B("features", { eyebrow: "Student support services", title: "Comprehensive support to help you succeed", columns: 4, style: "icon-left", items: [{ icon: "BookOpen", title: "Academic support", description: "One-on-one mentoring and personalised study guidance" }, { icon: "Briefcase", title: "Career services", description: "Job placement assistance and professional career counselling" }, { icon: "Laptop", title: "Technical resources", description: "Access to the latest software, hardware and development tools" }, { icon: "HeartHandshake", title: "Wellness support", description: "Mental health resources and wellness programmes" }] }, { tone: "white" }),
    B("cta", { style: "banner", title: "Become part of the iCET community", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Visit the campus", href: "/contact-us", variant: "ghost" } }, { tone: "navy" }),
  ], { title: "Student Life at iCET – Campus, Clubs, Events & Gallery", description: "Experience a vibrant iCET life filled with learning, innovation and community: modern labs, coding club, innovation hub, tech community, events and photo galleries." });

  await upsertPage("trainers", "Trainers", [
    B("page_hero", { eyebrow: "Faculty", title: "Panel of expert trainers", subtitle: "Our experienced lecturers bring unparalleled expertise, innovation and mentorship to our institute, shaping the future of tech education.", align: "center" }),
    B("trainers", { layout: "spotlight", show_bio: true }, { tone: "white" }),
    B("cta", { style: "card", title: "Learn from the people who build Sri Lanka's software", description: "Every lecturer at iCET is an active industry professional.", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Explore programmes", href: "/professional-it-courses-in-sri-lanka", variant: "ghost" } }, { tone: "light" }),
  ], { title: "Trainers – Panel of Expert Software Engineering Lecturers | iCET", description: "Meet iCET's panel of expert trainers: experienced software architects, AI specialists and tech leads who bring industry insights into the classroom.", og_image: await U("2026/06/Niroth-sir.png") });

  await upsertPage("contact-us", "Contact Us", [
    B("page_hero", { eyebrow: "Get in touch", title: "We'd love to hear from you", subtitle: "Reach out through any of these channels — our admissions team replies within one working day.", align: "center", compact: true }),
    B("contact", { show_form: true, show_map: true, form_title: "Send us a message", form_description: "Questions about programmes, fees or schedules? We're here to help." }, { tone: "white" }),
    B("faq", { eyebrow: "FAQ", title: "Frequently asked questions", group_slug: "general", layout: "two-column", cta: { label: "Still have questions? Call us", href: "tel:+94705805805", variant: "outline" } }, { tone: "light" }),
  ], { title: "Contact Us – iCET Panadura | +94 705 805 805", description: "Contact iCET - Institute of Computer Engineering Technology: 223 A Galle Road, Panadura. Call +94 705 805 805, email info@icet.lk or chat on WhatsApp.", faq_group_slug: "general" });

  await upsertPage("apply", "Apply Now", [
    B("page_hero", { eyebrow: "Your inquiry · 2026 September intake", title: "Apply to iCET", subtitle: "Advanced professional programmes in software engineering with AI. Submit your details and a student counsellor will guide you to the right programme and payment plan.", align: "left", compact: true, image: hero ? { url: hero, alt: "iCET students" } : undefined }),
    B("form", { kind: "apply", sidebar: true, eyebrow: "Online application", title: "Tell us about yourself" }, { tone: "light" }),
    B("steps", { eyebrow: "What happens next", title: "From inquiry to orientation", layout: "horizontal", numbered: true, items: [{ title: "Counsellor call", description: "We contact you within one working day to understand your goals." }, { title: "Offer letter", description: "Receive programme content, laptop specs and payment details." }, { title: "Payment plan", description: "Choose early bird, one-time discount or installments." }, { title: "Registration", description: "Submit your receipt and signed offer letter — you're in." }] }, { tone: "white" }),
    B("faq", { eyebrow: "FAQ", title: "Admissions questions", group_slug: "general", limit: 8 }, { tone: "light" }),
  ], { title: "Apply Now – 2026 September Intake | iCET Software Engineering Programmes", description: "Apply online for iCET's professional software engineering programmes (iCM, iCD, iCP). Get direct guidance from a student counsellor via WhatsApp or phone." });

  await upsertPage("icet-academic-informations", "iCET Academic Information", [
    B("page_hero", { eyebrow: "Research · Engineering · Innovation", title: "Professional programme in software engineering", subtitle: "A journey of innovation. Master the architectural depths of modern software development through our industry-aligned academic framework. TVEC recognised P03/0177.", ctas: [{ label: "Apply now", href: "/apply" }] }),
    B("rich_text", { width: "narrow", html: "<h2>Institute of Computer Engineering Technology</h2><p>The Institute of Computer Engineering Technology is a leader in computer engineering education in Sri Lanka, founded by Dr. Niroth Samarawickrama. Our mission is to empower students with the right skills and mindset for competitive roles in the Sri Lankan ICT sector, backed by a legacy of educating over 15,000 software engineering enthusiasts.</p><p>We are committed to delivering top-tier education through innovative, cutting-edge programmes tailored to meet the demands of today's job market. Our experienced lecturers and advanced teaching techniques ensure students are perfectly prepared for industry challenges.</p><p>We embrace excellence, innovation and a student-centric approach. Our programmes, including artificial intelligence, are future-ready, equipping students with the skills to thrive in a rapidly evolving tech landscape.</p>" }, { tone: "white" }),
    B("features", { columns: 2, style: "cards", items: [{ icon: "Telescope", title: "Vision", description: "To be the leader in the global computer engineering education sector, connecting individuals with the knowledge, skills and intelligence to excel in the global software engineering industry." }, { icon: "Target", title: "Mission", description: "To provide comprehensive software engineering education and industry-oriented training, equipping students with the technical expertise, practical experience and professional competence required for successful careers." }] }, { tone: "light" }),
    B("programs", { eyebrow: "Professional programmes", title: "Programmes designed to bridge academia and industry", style: "detailed" }, { tone: "white" }),
    B("trainers", { eyebrow: "Faculty", title: "Panel of expert trainers", layout: "grid", show_bio: false }, { tone: "light" }),
    B("steps", { eyebrow: "Register", title: "How to complete your registration", layout: "vertical", numbered: true, items: [{ title: "Fill the registration form", description: "Use the online application and your counsellor will contact you." }, { title: "Make the payment", description: "Commercial Bank · Account No: 1001008934 · Account name: Institute of Computer Engineering Technology (PVT) Ltd · Bank code 7056 · Panadura branch (041) · SWIFT: CCEYLKLX. Send the payment receipt to your counsellor." }, { title: "Submit your documents", description: "Submit the signed student agreement and supporting documents with the payment receipt. All documents should be in English and PDF format with proper titles (e.g. Shehan – Offer Letter)." }], cta: CTA_APPLY }, { tone: "white" }),
  ], { title: "iCET Academic Information – Programmes, Vision, Faculty & Registration", description: "Academic information about iCET's professional software engineering programmes, vision and mission, faculty and the registration process." });

  await upsertPage("ai-bootcamp", "AI Bootcamp", [
    B("page_hero", { eyebrow: "BuilderX Boot Camp", title: "Build and deploy your AI web app with confidence", subtitle: "Transform your vision into a production-ready AI application. Master context engineering, deployment strategies and build a portfolio-worthy project that opens new career opportunities.", ctas: [{ label: "Apply now", href: "/apply" }, { label: "Download syllabus", href: "/contact-us", variant: "ghost" }] }),
    B("features", { eyebrow: "The challenges holding you back", title: "Building AI apps is tough", description: "You're a developer with a vision — but the path is filled with challenges.", columns: 3, style: "cards", items: [{ icon: "Puzzle", title: "Scope creep", description: "Unclear project requirements that spiral out of control." }, { icon: "Bug", title: "Brittle AI prompts", description: "Unreliable outputs that frustrate users." }, { icon: "Server", title: "Deployment woes", description: "Lack of monitoring and error handling, making it hard to ship confidently." }] }, { tone: "white" }),
    B("steps", { eyebrow: "A clear 3-step plan", title: "Register. Build. Deploy.", layout: "horizontal", numbered: true, items: [{ title: "Register", description: "Secure your spot and prepare with pre-read materials and a setup checklist." }, { title: "Build", description: "A full-day hands-on workshop: design, integrate AI, implement context engineering and test your app." }, { title: "Deploy", description: "Ship your app to production with monitoring and analytics, then present it to showcase your skills." }] }, { tone: "light" }),
    B("features", { eyebrow: "Picture your success", title: "By the end of the bootcamp you'll have", columns: 3, style: "icon-left", items: [{ icon: "Rocket", title: "A functional AI web application", description: "Deployed on platforms like Vercel or Netlify." }, { icon: "BrainCircuit", title: "Context engineering mastery", description: "RAG techniques for reliable AI responses." }, { icon: "Award", title: "A portfolio-ready project", description: "With certificate of completion and LinkedIn digital badge." }, { icon: "ShieldCheck", title: "Production confidence", description: "Rapid prototyping, AI API integration and production-grade deployment." }, { icon: "Users", title: "Community access", description: "Ongoing learning and project showcases." }, { icon: "Code2", title: "Technical & practical skills", description: "Bolt.new, OpenAI/Anthropic APIs, vector databases, Python & TypeScript, requirements engineering, peer reviews." }] }, { tone: "white" }),
    B("cta", { style: "banner", eyebrow: "Spots are limited", title: "Don't wait — start your journey today", description: "Full-day intensive (8:00 AM – 5:00 PM), two 3-hour project camps and post-bootcamp community support.", primary_cta: { label: "Apply now", href: "/apply", variant: "white" }, secondary_cta: { label: "Contact us", href: "/contact-us", variant: "ghost" } }, { tone: "navy" }),
  ], { title: "AI Application Development Bootcamp with Context Engineering | iCET", description: "Build and deploy a production-ready AI web application in iCET's BuilderX bootcamp: context engineering, RAG, AI API integration and deployment." });

  await upsertPage("workshop-registration", "Workshop Registration", [
    B("page_hero", { eyebrow: "Limited seats", title: "Workshop registration", subtitle: "Reserve your seat for our current workshop or short course.", align: "center", compact: true }),
    B("form", { kind: "workshop", workshop_slug: "agentic-ai-development-short-course", sidebar: true, show_header: true }, { tone: "light" }),
  ], { title: "Workshop Registration | iCET", description: "Register for iCET workshops and short courses.", noindex: false });

  await upsertPage("icd-academic", "iCD Registration Page", [
    B("page_hero", { eyebrow: "Academic registration", title: "Academic registration form for iCET iCD128 Weekdays batch", subtitle: "Complete the form and upload your documents to finalise your registration.", align: "center", compact: true }),
    B("form", { kind: "batch", batch_slug: "icd128-weekdays", sidebar: false, show_header: false }, { tone: "light" }),
  ], { title: "iCD Academic Registration | iCET", noindex: true });
  await upsertPage("icp-academic", "iCP Academic", [
    B("page_hero", { eyebrow: "Academic registration", title: "Academic registration form for iCET iCP 26/27 batch", subtitle: "Complete the form and upload your documents to finalise your registration.", align: "center", compact: true }),
    B("form", { kind: "batch", batch_slug: "icp-26-27", sidebar: false, show_header: false }, { tone: "light" }),
  ], { title: "iCP Academic Registration | iCET", noindex: true });

  await upsertPage("feedback-form", "Feedback Form", [
    B("page_hero", { eyebrow: "Student feedback", title: "Agentic AI Short Course (SEP) – student feedback form", subtitle: "Thank you for participating in our Agentic AI Short Course. Your feedback helps us improve future sessions.", align: "center", compact: true }),
    B("form", { kind: "feedback", feedback_slug: "agentic-ai-short-course-sep", sidebar: false }, { tone: "light" }),
  ], { title: "Feedback Form | iCET", noindex: true });
  await upsertPage("parent-feedback", "Parent Feedback", [
    B("page_hero", { eyebrow: "2026 September intake", title: "ඔබ සැම ඉතා ගෞරවයෙන් හා ආදරයෙන් පිළිගනිමු!", subtitle: "අද දිනයේ සිට ආරම්භ වන ඔබේ ආදරණීය දරුවාගේ උසස් අධ්‍යාපන ජීවිතය සාර්ථක කර ගැනීමට, ඔබත් සමඟ අත්වැල් බැඳගැනීමට ලැබීම අපට විශාල ශක්තියකි.", align: "center", compact: true }),
    B("form", { kind: "feedback", feedback_slug: "september-intake-2026", sidebar: false }, { tone: "light" }),
  ], { title: "Parent Feedback | iCET", noindex: true });

  const legal = (title: string, html: string) => [B("page_hero", { title, align: "center", compact: true }), B("rich_text", { width: "narrow", html }, { tone: "white" })];
  await upsertPage("privacy-policy", "Privacy Policy", legal("Privacy Policy", `<p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p><h2>Who we are</h2><p>Institute of Computer Engineering Technology (Pvt) Ltd ("iCET", "we") operates icet.lk. Our registered office is 223 A, Galle Road, Panadura 12500, Sri Lanka.</p><h2>What we collect</h2><ul><li>Details you submit through inquiry, application, registration and feedback forms (name, contact details, academic background, uploaded documents).</li><li>Technical data such as IP address, browser and pages visited, collected through analytics cookies.</li></ul><h2>How we use it</h2><ul><li>To respond to inquiries and process applications and workshop registrations.</li><li>To issue and verify certificates.</li><li>To send programme information you have requested. You can opt out at any time.</li><li>To improve our website and services.</li></ul><h2>Sharing</h2><p>We do not sell personal data. Data is shared only with service providers who help us operate the website (hosting, email delivery) under confidentiality obligations, or where required by law.</p><h2>Retention and security</h2><p>Application documents are stored in private, access-controlled storage and retained only as long as necessary for admissions and record-keeping. Certificate records are retained permanently for verification.</p><h2>Your rights</h2><p>You may request access to, correction of, or deletion of your personal data by emailing <a href="mailto:info@icet.lk">info@icet.lk</a>.</p>`), { title: "Privacy Policy | iCET", description: "How iCET collects, uses and protects your personal data." });
  await upsertPage("terms-and-conditions", "Terms & Conditions", legal("Terms & Conditions", `<h2>Use of this website</h2><p>By using icet.lk you agree to these terms. Content is provided for information about iCET's programmes and services and may change without notice.</p><h2>Applications and registrations</h2><p>Submitting an inquiry or application does not guarantee admission. Fees, intakes and payment plans are confirmed in your offer letter. Early-bird and discount offers are valid for the periods stated and subject to terms communicated by your student counsellor.</p><h2>Certificates</h2><p>Certificates issued by iCET remain the property of iCET and may be suspended or revoked in cases of misconduct or administrative error. The public verification portal confirms validity only.</p><h2>Intellectual property</h2><p>All content, logos and course materials are the property of iCET or its licensors and may not be reproduced without permission.</p><h2>Contact</h2><p>Questions about these terms: <a href="mailto:info@icet.lk">info@icet.lk</a> · +94 705 805 805.</p>`), { title: "Terms & Conditions | iCET", description: "Terms of use for icet.lk, applications, registrations and certificates." });
  await upsertPage("cookie-policy", "Cookie Policy", legal("Cookie Policy", `<p>icet.lk uses cookies and similar technologies to make the site work and to understand how it is used.</p><h2>Essential cookies</h2><p>Required for security, form protection and the admin area. These cannot be switched off.</p><h2>Analytics and marketing cookies</h2><p>We may use Google Analytics, Google Tag Manager, Meta Pixel and Microsoft Clarity to measure traffic and the effectiveness of our campaigns. These are set only where enabled by iCET and can be blocked in your browser settings.</p><h2>Managing cookies</h2><p>You can delete or block cookies through your browser. Blocking essential cookies may stop parts of the site from working.</p>`), { title: "Cookie Policy | iCET", description: "How icet.lk uses cookies and analytics." });
  console.log("pages ✓");
}

/* ───────────────────────── Feedback forms, redirects, users ───────────────────────── */
async function seedFeedback() {
  const forms = [
    { slug: "default", name: "Default Form", is_default: true, questions: [["මව / පියා / භාරකරුගේ නම", "text", false]] },
    { slug: "september-intake-2026", name: "iCET - SEPTEMBER INTAKE 2026", intro: "<p>iCET අප ආයතනය වෙතින් ඔබ සැම 2026 September Intake සඳහා ඉතා ගෞරවයෙන් හා ආදරයෙන් පිළිගනිමු!</p>", questions: [["මව / පියා / භාරකරුගේ නම", "text", true], ["ජංගම දුරකථන අංකය", "text", true], ["WhatsApp අංකය", "text", true], ["ශිෂ්‍යයා / ශිෂ්‍යාවගේ සම්පූර්ණ නම", "text", true], ["ඔබගේ අත්දැකීම සහ අදහස්\nහිතවත් දෙමාපියනි, iCET අප ආයතනය පිළිබඳ ඔබගේ අත්දැකීම පහතින් යොමු කරන්න.", "info", false], ["ඔබගේ අත්දැකීම", "textarea", false], ["iCET ආයතනය පිළිබඳ ඔබගේ ඇගයීම", "rating", false]] },
    { slug: "agentic-ai-short-course-sep", name: "Agentic AI Short Course - SEP intake", intro: "<p>Thank you for participating in our Agentic AI Short Course. Your feedback is valuable to us and will help us understand your experience, improve future sessions, and deliver better learning opportunities.</p>", questions: [["1. Full Name", "text", false], ["2. Occupation / Current Status", "text", false], ["3. How do you feel about your overall experience with the Agentic AI Programme?", "textarea", false], ["4. How would you rate the programme overall?", "rating", false]] },
  ];
  for (const f of forms) {
    const r = await sql<{ id: number }[]>`insert into public.feedback_forms (slug, name, intro_html, google_review_url, redirect_min_rating, thankyou_message, submit_label, is_default, is_active)
      values (${f.slug}, ${f.name}, ${f.intro || ""}, 'https://g.page/r/CXAU5HxS42BAEBM/review', 0, 'Thank you for your feedback!', 'Submit Feedback', ${!!f.is_default}, true)
      on conflict (slug) do update set name = excluded.name, intro_html = excluded.intro_html returning id`;
    const existing = await sql<{ n: number }[]>`select count(*)::int as n from public.feedback_questions where form_id = ${r[0].id}`;
    if (existing[0].n === 0) {
      let i = 0;
      for (const [q, t, req] of f.questions) await sql`insert into public.feedback_questions (form_id, question, field_type, is_required, sort_order) values (${r[0].id}, ${q as string}, ${t as string}, ${req as boolean}, ${i++})`;
    }
  }
  const redirects: [string, string][] = [["/icet-certified-master", "/software-development-course-university-students"], ["/professional-programmes", "/professional-it-courses-in-sri-lanka"], ["/certifications-verification", "/verify-certificate"], ["/event-directory", "/events"], ["/alumni", "/industry-placement"], ["/devops-workshop-registration", "/register/devops-workshop"]];
  for (const [from, to] of redirects) await sql`insert into public.redirects (from_path, to_path, status_code) values (${from}, ${to}, 301) on conflict (from_path) do nothing`;

  // Existing WordPress administrators → inactive editor accounts (super admin activates & sets passwords)
  const wpAdmins: [string, string][] = [["icet.pawani@gmail.com", "Pawani Alahakoon"], ["dewmalnilanka@gmail.com", "Dewmal Handapangoda"], ["icet.coordinator05@gmail.com", "Meeshani"], ["icet.graphic@gmail.com", "Pasindu"], ["icet.pawara@gmail.com", "Pawara"], ["icet.prathibha@gmail.com", "Prathibha"], ["ravindu@icet.lk", "Ravindu"], ["icet.sachin@gmail.com", "Sachin"]];
  for (const [email, name] of wpAdmins) {
    const exists = await sql`select 1 from public.profiles where email = ${email}`;
    if (exists.length) continue;
    const pw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!9";
    await sql`select public.admin_create_user(${email}, ${pw}, ${name}, 'editor')`;
    await sql`update public.profiles set is_active = false where email = ${email}`;
  }
  console.log("feedback/redirects/users ✓");
}

async function main() {
  console.log("Seeding iCET content → Supabase…");
  token = await getToken();
  await uploadMediaLibrary();
  await seedSettings();
  await seedPrograms();
  await seedPeople();
  await seedFaqs();
  await seedEvents();
  await seedGallery();
  await seedPages();
  await seedFeedback();
  console.log("Done. Run `npm run seed:registry` to migrate workshops, batches, students and certificates.");
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
