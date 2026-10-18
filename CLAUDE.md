# iCET website (Next.js 16 + Supabase) — project conventions

Rebuild of https://icet.lk (WordPress) as a Next.js 16 App Router site with a full admin CMS.
Old site reference material lives in `../icet-web` (WordPress plugins we ported: `icet-certificate-manager`, `Google-Review-Redirect-Feedback-Form`).

## Stack
- Next.js 16 (`cacheComponents: true`, Turbopack, `proxy.ts` instead of middleware), React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`).
- Supabase: Postgres (schema in `supabase/schema.sql`), Auth (email/password for staff), Storage buckets `media` (public), `applications` (private), `certificates` (public).
- Server data access: `sql` tagged template from `src/lib/db.ts` (`postgres` driver, privileged, server-only). Public content reads live in `src/lib/data/*` and are wrapped in `"use cache"` + `cacheTag(TAGS.x)`; admin mutations call `bust(TAGS.x)` from `src/lib/revalidate.ts`.
- Browser Supabase client only for auth + admin storage uploads (`src/lib/supabase/client.ts`).

## Caching rules (Cache Components)
- Public pages: fetch through `src/lib/data/*` (cached). Anything reading `cookies()`/`searchParams` must sit under `<Suspense>`.
- Admin (`src/app/admin/(dashboard)`): the layout wraps children in Suspense and `requireUser()`; admin pages may read the DB directly (uncached) with `sql`.
- After any write to content tables, call `bust(...)` with the matching tags (see `src/lib/cache.ts`).

## Auth & roles
- `profiles.role`: `super_admin` > `admin` > `editor` > `viewer`. Helpers: `requireUser(min)` (pages), `assertRole(min)` (server actions / route handlers), `audit(user, action, entity, id, meta)`.
- Staff users are created with SQL function `public.admin_create_user(email, password, full_name, role)` (no service-role key needed). Passwords: `public.admin_set_password(uid, pw)`.

## Admin UI conventions
- Use components from `src/components/admin/ui.tsx` (PageHeader, Panel, StatCard, DataTable, Pagination, SearchBox, StatusBadge, AInput/ATextarea/ASelect/AField, Toggle, Modal, Tabs, SubmitButton, ActionToast, useToast, ConfirmButton, EmptyState) and `src/components/ui/button.tsx`.
- Server actions live next to their route in `actions.ts` with `"use server"`, start with `const user = await assertRole("editor")`, validate with zod, return `ActionState` (`{ ok, message, errors? }`), call `bust()` + `audit()`.
- Lists: `?q=&page=&status=` query params, 25 per page, server-rendered. Forms: React 19 `useActionState` + `SubmitButton`.
- Rich text: Tiptap editor component `src/components/admin/rich-text.tsx`; always store HTML sanitised with `sanitizeHtml` on save.
- Images: pick from the media library via `src/components/admin/media-picker.tsx` (returns public URL). Uploads go to bucket `media` under `uploads/<yyyy>/<mm>/<slug>-<rand>.<ext>` and insert a row in `public.media`.

## Gotchas learned
- `reg_workshops.form_fields`, `reg_batches.form_fields`, `reg_applications.answers_json` are `json` (not `jsonb`) because question order must survive. Write them with `${JSON.stringify(obj)}` — never `sql.json()` (it is typed jsonb and would re-sort keys).
- Public routes must only read through cached functions (`"use cache"` in `src/lib/data/*`, incl. `src/lib/data/registry.ts`); uncached reads break prerendering. Dynamic routes need `generateStaticParams`.
- Admin pages start with `await connection()` and export `instant = false` (request-time only).
- `Pagination` takes `baseHref` as a URL **template** containing `{page}` or `__PAGE__` (functions cannot cross the server→client boundary).
- Wrap dnd-kit `DndContext` with a stable `id={useId()}` to avoid hydration mismatches.
- Do not call `Date.now()`/`new Date()` in public server components during render; compute inside cached data functions or use the client `<Year />` component.

## Content model
- Pages are block lists (`src/lib/blocks/types.ts`, registry with admin field specs in `src/lib/blocks/registry.ts`, renderer `src/components/blocks/render.tsx`). Programmes (`programs` table) render through `src/components/site/program-page.tsx` with `content.blocks`.
- Registration/intake forms share the field model in `src/lib/registry/fields.ts` (port of the WP plugin): types text/textarea/radio/checkbox/select/file/date/number/email/tel + layout `section` (page break) / `heading`.
- Certificates: `src/lib/registry/service.ts` (register, verify, issue) and `src/lib/registry/pdf.ts` (pdf-lib). Mapping items `{var_key,x,y,font_size,font_color,font_weight,align}` use template-image pixel coordinates (origin top-left).

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- `npm run seed` (scripts/seed.ts) — migrates WordPress content/images and registry data into Supabase (idempotent upserts).
- Apply schema: `psql "$DATABASE_URL" -f supabase/schema.sql`

## Style
- Brand blue `--brand-600 #046bd2`, navy `#0b1f3a`, surface `#f0f5fa`, accent green `#16a34a`. Radius 10px (cards 16px). Fonts: Plus Jakarta Sans (display) + Inter.
- Keep copy in British/Sri Lankan English ("programme"). Phone `+94 705 805 805`, TVEC `P03/0177`.
