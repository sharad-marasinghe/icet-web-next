-- ═══════════════════════════════════════════════════════════════════════════
-- iCET Website — Supabase schema
-- Applies cleanly to an empty project. Re-runnable (IF NOT EXISTS everywhere).
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ───────────────────────────── helpers ──────────────────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────────── profiles / roles ─────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('super_admin','admin','editor','viewer');
  end if;
end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        public.admin_role not null default 'viewer',
  avatar_url  text,
  is_active   boolean not null default true,
  last_login_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Auto-create a profile row for every auth user (role viewer until promoted).
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce((new.raw_user_meta_data->>'role')::public.admin_role, 'viewer'))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.current_role() returns public.admin_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','admin','editor') from public.profiles where id = auth.uid() and is_active), false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','admin') from public.profiles where id = auth.uid() and is_active), false)
$$;

-- Create / update an auth user from SQL (no service-role key needed).
create or replace function public.admin_create_user(p_email text, p_password text, p_full_name text, p_role public.admin_role)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, is_super_admin)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email),
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', p_role::text), now(), now(), '', '', '', '', false);
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true), 'email', now(), now(), now());
  else
    if p_password is not null and p_password <> '' then
      update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = uid;
    end if;
  end if;
  insert into public.profiles (id, email, full_name, role) values (uid, lower(p_email), p_full_name, p_role)
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = true;
  return uid;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = p_user;
end $$;

-- ───────────────────────────── settings & navigation ────────────────────────
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  is_public  boolean not null default true,   -- false = never readable by anon (SMTP etc.)
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.navigation_menus (
  slug       text primary key,              -- header | footer_quick | footer_programs | footer_legal
  title      text not null,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.redirects (
  id          bigserial primary key,
  from_path   text not null unique,
  to_path     text not null,
  status_code smallint not null default 301,
  is_active   boolean not null default true,
  hits        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────── CMS content ──────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'publish_status') then
    create type public.publish_status as enum ('draft','published','archived');
  end if;
end $$;

create table if not exists public.pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                  -- '' is not allowed; home uses 'home'
  title        text not null,
  template     text not null default 'blocks',        -- blocks | program | custom:<key>
  blocks       jsonb not null default '[]'::jsonb,    -- ordered block list (see src/lib/blocks)
  seo          jsonb not null default '{}'::jsonb,    -- {title, description, og_image, canonical, noindex, keywords, schema}
  status       public.publish_status not null default 'published',
  show_in_search boolean not null default true,
  published_at timestamptz default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id)
);
drop trigger if exists trg_pages_updated on public.pages;
create trigger trg_pages_updated before update on public.pages for each row execute function public.set_updated_at();

create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- iCM | iCD | iCP
  slug          text not null unique,          -- public URL slug
  name          text not null,                 -- iCET Certified Developer
  qualification text not null default '',      -- Diploma in Software Engineering
  tagline       text not null default '',
  summary       text not null default '',
  level_label   text not null default '',      -- 'PROFESSIONAL DIPLOMA · TVEC-ALIGNED · AFTER A/L'
  duration      text not null default '',
  training      text not null default '',      -- '6-Month Industrial Training'
  mode          text not null default 'Online / Physical / Hybrid',
  logo_url      text,
  hero_image    text,
  brochure_url  text,
  fee_from      numeric(12,2),
  accent        text not null default '#046BD2',
  content       jsonb not null default '{}'::jsonb, -- audiences, levels, payment_plans, outcomes, steps, faq_group, testimonials…
  seo           jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_programs_updated on public.programs;
create trigger trg_programs_updated before update on public.programs for each row execute function public.set_updated_at();

create table if not exists public.trainers (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  title          text not null default '',          -- designation
  qualifications text not null default '',
  bio            text not null default '',
  email          text,
  photo_url      text,
  linkedin_url   text,
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null default '',
  company     text not null default '',
  quote       text not null,
  photo_url   text,
  video_url   text,
  program_code text,
  rating      smallint,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text not null,
  website_url text,
  category    text not null default 'industry',   -- industry | training | academic
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.faq_groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);
create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.faq_groups(id) on delete cascade,
  question    text not null,
  answer      text not null,                  -- HTML allowed (sanitised on save)
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_faqs_group on public.faqs(group_id, sort_order);

create table if not exists public.event_categories (
  id    serial primary key,
  slug  text not null unique,
  name  text not null,
  color text not null default '#046BD2'
);
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  excerpt          text not null default '',
  content          text not null default '',      -- HTML
  start_at         timestamptz not null,
  end_at           timestamptz,
  all_day          boolean not null default false,
  timezone         text not null default 'Asia/Colombo',
  venue            text not null default '',
  address          text not null default '',
  is_online        boolean not null default false,
  image_url        text,
  cost             text not null default '',
  registration_url text,
  workshop_id      bigint,                          -- optional link to reg_workshops
  category_ids     integer[] not null default '{}',
  speakers         jsonb not null default '[]'::jsonb,   -- [{name,title,photo_url}]
  status           public.publish_status not null default 'published',
  is_featured      boolean not null default false,
  seo              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_events_start on public.events(start_at desc);
drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated before update on public.events for each row execute function public.set_updated_at();

create table if not exists public.post_categories (
  id    serial primary key,
  slug  text not null unique,
  name  text not null
);
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text not null default '',
  content       text not null default '',          -- HTML (Tiptap)
  cover_image   text,
  author_id     uuid references public.profiles(id),
  author_name   text not null default '',
  author_title  text not null default '',
  author_photo  text,
  category_ids  integer[] not null default '{}',
  tags          text[] not null default '{}',
  reading_minutes integer not null default 5,
  status        public.publish_status not null default 'draft',
  is_featured   boolean not null default false,
  published_at  timestamptz,
  seo           jsonb not null default '{}'::jsonb,
  views         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_posts_published on public.posts(status, published_at desc);
drop trigger if exists trg_posts_updated on public.posts;
create trigger trg_posts_updated before update on public.posts for each row execute function public.set_updated_at();

create table if not exists public.gallery_albums (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text not null default '',
  cover_url   text,
  event_date  date,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.gallery_images (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.gallery_albums(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  caption    text not null default '',
  width      integer,
  height     integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_gallery_images_album on public.gallery_images(album_id, sort_order);

create table if not exists public.videos (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  youtube_id    text not null,
  thumbnail_url text,
  collection    text not null default 'student_life',   -- student_life | alumni_podcast | testimonials
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null default 'media',
  path        text not null,
  url         text not null,
  folder      text not null default '',
  filename    text not null,
  title       text not null default '',
  alt         text not null default '',
  mime_type   text not null default '',
  size_bytes  bigint not null default 0,
  width       integer,
  height      integer,
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);
create index if not exists idx_media_folder on public.media(folder, created_at desc);

-- ───────────────────────────── inquiries (Apply / Contact) ──────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'inquiry_status') then
    create type public.inquiry_status as enum ('new','contacted','qualified','converted','closed','spam');
  end if;
end $$;
create table if not exists public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'apply',           -- apply | contact | callback | brochure
  name          text not null,
  email         text not null default '',
  phone         text not null default '',
  whatsapp      text not null default '',
  program_code  text,
  intake        text,
  message       text not null default '',
  data          jsonb not null default '{}'::jsonb,       -- O/L, A/L, university etc.
  utm           jsonb not null default '{}'::jsonb,
  page_path     text,
  status        public.inquiry_status not null default 'new',
  assigned_to   uuid references public.profiles(id),
  notes         text not null default '',
  ip_hash       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_inquiries_status on public.inquiries(status, created_at desc);
drop trigger if exists trg_inquiries_updated on public.inquiries;
create trigger trg_inquiries_updated before update on public.inquiries for each row execute function public.set_updated_at();

-- ───────────────────────────── Registry (workshops / batches / certificates) ─
do $$ begin
  if not exists (select 1 from pg_type where typname = 'workshop_status') then
    create type public.workshop_status as enum ('draft','active','completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('submitted','under_review','shortlisted','accepted','rejected','withdrawn');
  end if;
  if not exists (select 1 from pg_type where typname = 'certificate_status') then
    create type public.certificate_status as enum ('valid','revoked');
  end if;
end $$;

create table if not exists public.reg_batches (
  id              bigserial primary key,
  slug            text not null unique,
  batch_name      text not null,
  course_code     text not null default '',
  intro_title     text not null default '',
  intro_html      text not null default '',
  form_fields     json  not null default '{}'::json,   -- json (not jsonb): question order must be preserved
  form_version    integer not null default 1,
  email_settings  jsonb not null default '{}'::jsonb,
  is_open         boolean not null default true,
  opens_at        timestamptz,
  closes_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_reg_batches_updated on public.reg_batches;
create trigger trg_reg_batches_updated before update on public.reg_batches for each row execute function public.set_updated_at();

create table if not exists public.reg_workshops (
  id                       bigserial primary key,
  slug                     text not null unique,
  title                    text not null,
  description              text not null default '',
  hero_image               text,
  certificate_template_url text,
  certificate_mapping      jsonb not null default '[]'::jsonb,
  form_fields              json  not null default '{}'::json,   -- json keeps key order
  cert_id_prefix           text not null default '',
  registration_page_url    text,
  registration_campaign    text,
  email_settings           jsonb not null default '{}'::jsonb,
  status                   public.workshop_status not null default 'active',
  seats                    integer,
  starts_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
drop trigger if exists trg_reg_workshops_updated on public.reg_workshops;
create trigger trg_reg_workshops_updated before update on public.reg_workshops for each row execute function public.set_updated_at();

create table if not exists public.reg_students (
  id            bigserial primary key,
  student_id    text not null unique,
  batch_id      bigint references public.reg_batches(id) on delete set null,
  student_name  text not null,
  student_email text not null,
  student_phone text,
  extra_fields  jsonb not null default '{}'::jsonb,
  registered_at timestamptz not null default now()
);
create index if not exists idx_reg_students_email on public.reg_students(lower(student_email));
create index if not exists idx_reg_students_batch on public.reg_students(batch_id);
create index if not exists idx_reg_students_name_trgm on public.reg_students using gin (student_name gin_trgm_ops);

create table if not exists public.reg_enrollments (
  id                    bigserial primary key,
  student_id            bigint not null references public.reg_students(id) on delete cascade,
  workshop_id           bigint not null references public.reg_workshops(id) on delete cascade,
  enrolled_at           timestamptz not null default now(),
  certificate_code      text unique,
  email_sent_status     boolean not null default false,
  registration_source   text not null default 'direct',
  registration_medium   text,
  registration_campaign text,
  unique (student_id, workshop_id)
);
create index if not exists idx_reg_enroll_ws on public.reg_enrollments(workshop_id, registration_source);

create table if not exists public.reg_attendance (
  id          bigserial primary key,
  student_id  bigint not null references public.reg_students(id) on delete cascade,
  workshop_id bigint not null references public.reg_workshops(id) on delete cascade,
  is_attended boolean not null default false,
  marked_at   timestamptz not null default now(),
  marked_by   uuid references public.profiles(id),
  unique (student_id, workshop_id)
);

create table if not exists public.reg_certificates (
  id                bigserial primary key,
  certificate_id    text not null unique,
  student_id        bigint not null references public.reg_students(id) on delete cascade,
  workshop_id       bigint references public.reg_workshops(id) on delete set null,
  course_name       text not null,
  issue_date        date not null default current_date,
  certificate_hash  text not null unique,
  status            public.certificate_status not null default 'valid',
  is_suspended      boolean not null default false,
  suspension_reason text,
  pdf_url           text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_reg_cert_student on public.reg_certificates(student_id);

create table if not exists public.reg_applications (
  id            bigserial primary key,
  batch_id      bigint not null references public.reg_batches(id) on delete cascade,
  student_id    bigint not null references public.reg_students(id) on delete cascade,
  reference_no  text not null unique,
  form_version  integer not null default 1,
  status        public.application_status not null default 'submitted',
  answers_json  json  not null default '{}'::json,
  review_notes  text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (batch_id, student_id)
);
create index if not exists idx_reg_app_batch_status on public.reg_applications(batch_id, status);
drop trigger if exists trg_reg_applications_updated on public.reg_applications;
create trigger trg_reg_applications_updated before update on public.reg_applications for each row execute function public.set_updated_at();

create table if not exists public.reg_application_answers (
  id             bigserial primary key,
  application_id bigint not null references public.reg_applications(id) on delete cascade,
  batch_id       bigint not null,
  field_key      text not null,
  value_text     text,
  value_num      numeric(20,4)
);
create index if not exists idx_reg_ans_app on public.reg_application_answers(application_id, field_key);
create index if not exists idx_reg_ans_batch on public.reg_application_answers(batch_id, field_key, value_text);

create table if not exists public.reg_application_files (
  id             bigserial primary key,
  application_id bigint not null references public.reg_applications(id) on delete cascade,
  field_key      text not null,
  original_name  text not null,
  stored_path    text not null,              -- path inside private bucket "applications"
  mime_type      text not null default '',
  size_bytes     bigint not null default 0,
  uploaded_at    timestamptz not null default now()
);
create index if not exists idx_reg_files_app on public.reg_application_files(application_id, field_key);

create table if not exists public.rate_limits (
  key        text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);

create table if not exists public.email_log (
  id          bigserial primary key,
  to_email    text not null,
  subject     text not null,
  kind        text not null default 'generic',    -- registration | certificate | inquiry | test
  status      text not null default 'sent',       -- sent | failed
  error       text,
  entity_type text,
  entity_id   text,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────── Feedback forms (Google review redirect) ─────
create table if not exists public.feedback_forms (
  id                  bigserial primary key,
  slug                text not null unique,
  name                text not null,
  intro_html          text not null default '',
  google_review_url   text not null default '',
  redirect_min_rating smallint not null default 0,  -- 0 = always redirect
  thankyou_message    text not null default 'Thank you for your feedback!',
  submit_label        text not null default 'Submit Feedback',
  is_default          boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create table if not exists public.feedback_questions (
  id          bigserial primary key,
  form_id     bigint not null references public.feedback_forms(id) on delete cascade,
  question    text not null,
  field_type  text not null default 'text',  -- text | textarea | rating | yes_no | info
  is_required boolean not null default false,
  sort_order  integer not null default 0
);
create index if not exists idx_fb_questions_form on public.feedback_questions(form_id, sort_order);
create table if not exists public.feedback_responses (
  id         bigserial primary key,
  form_id    bigint not null references public.feedback_forms(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,   -- {question_id: answer}
  rating     smallint,
  redirected boolean not null default false,
  ip_hash    text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_fb_responses_form on public.feedback_responses(form_id, created_at desc);

-- ───────────────────────────── audit log ────────────────────────────────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  user_id     uuid,
  user_email  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log(created_at desc);

-- ───────────────────────────── Row Level Security ───────────────────────────
-- Public (anon) may read published content. Staff may write. Everything else is
-- server-only (accessed through the server-side Postgres connection).
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','site_settings','navigation_menus','redirects','pages','programs','trainers','testimonials','partners',
    'faq_groups','faqs','event_categories','events','post_categories','posts','gallery_albums','gallery_images','videos','media',
    'inquiries','reg_batches','reg_workshops','reg_students','reg_enrollments','reg_attendance','reg_certificates',
    'reg_applications','reg_application_answers','reg_application_files','rate_limits','email_log',
    'feedback_forms','feedback_questions','feedback_responses','audit_log'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Public read policies
drop policy if exists public_read on public.site_settings;
create policy public_read on public.site_settings for select using (is_public);
drop policy if exists public_read on public.navigation_menus;
create policy public_read on public.navigation_menus for select using (true);
drop policy if exists public_read on public.pages;
create policy public_read on public.pages for select using (status = 'published');
drop policy if exists public_read on public.programs;
create policy public_read on public.programs for select using (is_active);
drop policy if exists public_read on public.trainers;
create policy public_read on public.trainers for select using (is_active);
drop policy if exists public_read on public.testimonials;
create policy public_read on public.testimonials for select using (is_active);
drop policy if exists public_read on public.partners;
create policy public_read on public.partners for select using (is_active);
drop policy if exists public_read on public.faq_groups;
create policy public_read on public.faq_groups for select using (true);
drop policy if exists public_read on public.faqs;
create policy public_read on public.faqs for select using (is_active);
drop policy if exists public_read on public.event_categories;
create policy public_read on public.event_categories for select using (true);
drop policy if exists public_read on public.events;
create policy public_read on public.events for select using (status = 'published');
drop policy if exists public_read on public.post_categories;
create policy public_read on public.post_categories for select using (true);
drop policy if exists public_read on public.posts;
create policy public_read on public.posts for select using (status = 'published');
drop policy if exists public_read on public.gallery_albums;
create policy public_read on public.gallery_albums for select using (is_active);
drop policy if exists public_read on public.gallery_images;
create policy public_read on public.gallery_images for select using (true);
drop policy if exists public_read on public.videos;
create policy public_read on public.videos for select using (is_active);
drop policy if exists public_read on public.media;
create policy public_read on public.media for select using (true);
-- A signed-in staff member can always read their own profile.
drop policy if exists self_read on public.profiles;
create policy self_read on public.profiles for select to authenticated using (id = auth.uid());

-- ───────────────────────────── Storage buckets ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 52428800, null)
on conflict (id) do update set public = true, file_size_limit = 52428800;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applications','applications', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public, file_size_limit)
values ('certificates','certificates', true, 10485760)
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id in ('media','certificates'));
drop policy if exists "staff write media" on storage.objects;
create policy "staff write media" on storage.objects for insert to authenticated with check (bucket_id in ('media','certificates') and public.is_staff());
drop policy if exists "staff update media" on storage.objects;
create policy "staff update media" on storage.objects for update to authenticated using (bucket_id in ('media','certificates') and public.is_staff());
drop policy if exists "staff delete media" on storage.objects;
create policy "staff delete media" on storage.objects for delete to authenticated using (bucket_id in ('media','certificates') and public.is_staff());
drop policy if exists "staff read applications" on storage.objects;
create policy "staff read applications" on storage.objects for select to authenticated using (bucket_id = 'applications' and public.is_staff());

-- ───────────────────────────── Search (public pages, posts, events) ─────────
create or replace function public.site_search(q text, lim int default 20)
returns table (kind text, title text, url text, snippet text, image_url text, rank real)
language sql stable as $$
  with qry as (select plainto_tsquery('english', q) as tsq, '%'||q||'%' as lk)
  select * from (
    select 'page'::text, p.title, case when p.slug='home' then '/' else '/'||p.slug end,
           left(coalesce(p.seo->>'description',''), 180), p.seo->>'og_image',
           ts_rank(to_tsvector('english', p.title||' '||coalesce(p.seo->>'description','')||' '||p.blocks::text), (select tsq from qry))::real
      from public.pages p, qry
     where p.status='published' and p.show_in_search
       and (to_tsvector('english', p.title||' '||coalesce(p.seo->>'description','')||' '||p.blocks::text) @@ qry.tsq or p.title ilike qry.lk)
    union all
    select 'program', pr.name||' — '||pr.qualification, '/'||pr.slug, left(pr.summary,180), pr.logo_url,
           ts_rank(to_tsvector('english', pr.name||' '||pr.qualification||' '||pr.summary), (select tsq from qry))::real + 0.5
      from public.programs pr, qry
     where pr.is_active and (to_tsvector('english', pr.name||' '||pr.qualification||' '||pr.summary||' '||pr.content::text) @@ qry.tsq or pr.name ilike qry.lk or pr.code ilike qry.lk)
    union all
    select 'event', e.title, '/events/'||e.slug, left(e.excerpt,180), e.image_url,
           ts_rank(to_tsvector('english', e.title||' '||e.excerpt||' '||e.content), (select tsq from qry))::real
      from public.events e, qry
     where e.status='published' and (to_tsvector('english', e.title||' '||e.excerpt||' '||e.content) @@ qry.tsq or e.title ilike qry.lk)
    union all
    select 'post', po.title, '/blogs/'||po.slug, left(po.excerpt,180), po.cover_image,
           ts_rank(to_tsvector('english', po.title||' '||po.excerpt||' '||po.content), (select tsq from qry))::real
      from public.posts po, qry
     where po.status='published' and (to_tsvector('english', po.title||' '||po.excerpt||' '||po.content) @@ qry.tsq or po.title ilike qry.lk)
    union all
    select 'trainer', t.name, '/trainers#'||t.slug, left(t.title,180), t.photo_url, 0.3::real
      from public.trainers t, qry where t.is_active and t.name ilike qry.lk
  ) s(kind,title,url,snippet,image_url,rank)
  order by rank desc, title limit lim
$$;
