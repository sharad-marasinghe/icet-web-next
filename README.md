# iCET website — Next.js 16 + Supabase

Rebuild of [icet.lk](https://icet.lk) with a block-based CMS, admissions inquiries, workshop registrations, academic intake applications, certificate issuing/verification and Google-review feedback forms.

## Quick start

```bash
cp .env.example .env.local        # fill in Supabase keys + DATABASE_URL (see below)
npm install
psql "$DATABASE_URL" -f supabase/schema.sql   # creates tables, RLS policies, storage buckets, SQL helpers
npm run seed                       # migrates WordPress content + images (idempotent)
npm run seed:registry              # workshops, batches, students, certificates
npm run dev                        # http://localhost:3000  ·  admin at /admin
```

### Environment
| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project (browser + server) |
| `DATABASE_URL` | Postgres **session pooler** URL (`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`) — server only |
| `DATABASE_POOL_URL` | Optional transaction pooler (port 6543) for serverless deployments |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. When absent, storage writes from the server use `STORAGE_USER`/`STORAGE_PASSWORD` (a staff account) |
| `APP_SECRET` | Signs public form tokens (anti-bot), download links |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for SEO, emails and certificate links |
| `SMTP_*` | Optional; SMTP can also be configured in **Admin → Registry → Email settings** |

### Create the first admin
```sql
select public.admin_create_user('you@icet.lk', 'strong-password', 'Your Name', 'super_admin');
```
Roles: `super_admin` > `admin` > `editor` > `viewer`. Manage users in **Admin → Users & roles**.

## Architecture
- `src/app/(site)` — public site. Pages are block lists stored in `pages.blocks`; programmes render from `programs`. Data access in `src/lib/data/*` is cached with Cache Components (`"use cache"` + tags) and revalidated by admin actions.
- `src/app/admin` — staff area (Supabase Auth). Modules: pages/block editor, programmes, trainers, testimonials, partners, FAQs, events, blog, gallery, videos, media library, inquiries CRM, registry (workshops, batches, students, applications, certificates, email), feedback forms, navigation, settings, redirects/SEO, users, audit log.
- `src/lib/registry` — port of the WordPress certificate manager: dynamic form definitions, registration pipeline, PDF certificates (pdf-lib), verification.
- `src/app/api` — public endpoints: `/api/register`, `/api/inquiry`, `/api/feedback`, `/api/verify`, `/api/search`, `/api/form-token`.
- `supabase/schema.sql` — full schema, RLS, storage buckets (`media` public, `applications` private, `certificates` public), SQL helpers.

## Scripts
`npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm run typecheck` · `npm run seed` · `npm run seed:registry`

## Deploying
Works on Vercel or any Node host. Set the env vars above (use `DATABASE_POOL_URL` on serverless), run `npm run build`. Point DNS for icet.lk to the deployment; legacy WordPress URLs are redirected in `next.config.ts` and the `redirects` table.
