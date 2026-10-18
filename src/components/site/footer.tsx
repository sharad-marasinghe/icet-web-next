import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Clock, MessageCircle, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Facebook, Youtube, Linkedin, Instagram, Tiktok, XIcon } from "@/components/ui/brand-icons";
import type { NavItem, SiteSettings } from "@/lib/data/settings";
import { Year } from "./year";

export function SiteFooter({ settings, footer }: { settings: SiteSettings; footer: Record<string, NavItem[]> }) {
  const socials = [
    { key: "facebook", Icon: Facebook, label: "Facebook" },
    { key: "youtube", Icon: Youtube, label: "YouTube" },
    { key: "linkedin", Icon: Linkedin, label: "LinkedIn" },
    { key: "instagram", Icon: Instagram, label: "Instagram" },
    { key: "tiktok", Icon: Tiktok, label: "TikTok" },
    { key: "x", Icon: XIcon, label: "X" },
  ] as const;
  const wa = settings.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(settings.whatsapp_message)}` : null;

  return (
    <footer className="relative mt-auto bg-navy text-slate-300">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
      <div className="container-x grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="iCET home">
            {settings.logo_dark_url || settings.logo_url ? (
              <Image src={settings.logo_dark_url || settings.logo_url} alt="iCET" width={170} height={52} className="h-12 w-auto rounded-md bg-white/95 p-1.5" />
            ) : (
              <span className="font-display text-2xl font-extrabold text-white">iCET</span>
            )}
          </Link>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-400">{settings.footer_about}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-accent-500" /> TVEC Registered · {settings.tvec_reg_no}
          </div>
          <div className="mt-6 flex gap-2">
            {socials.map(({ key, Icon, label }) => {
              const href = settings.social?.[key];
              if (!href) return null;
              return (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10 transition hover:bg-brand-600 hover:text-white">
                  <Icon className="h-4.5 w-4.5" />
                </a>
              );
            })}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10 transition hover:bg-accent-600 hover:text-white">
                <MessageCircle className="h-4.5 w-4.5" />
              </a>
            )}
          </div>
        </div>

        <FooterCol title="Quick Links" items={footer.footer_quick ?? []} />
        <FooterCol title="Programmes" items={footer.footer_programs ?? []} />

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">Contact Us</h3>
          <ul className="mt-5 space-y-3.5 text-[15px]">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <a href={settings.map_url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {settings.address_line1}{settings.address_line2 ? `, ${settings.address_line2}` : ""}, {settings.city} {settings.postal_code}, {settings.country}
              </a>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <a href={`tel:${settings.phone}`} className="font-semibold text-white hover:text-brand-300">{settings.phone_display}</a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <span className="flex flex-col">
                <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a>
                {settings.email_academics && <a href={`mailto:${settings.email_academics}`} className="hover:text-white">{settings.email_academics}</a>}
              </span>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <span>Opening Hours: {settings.opening_hours}</span>
            </li>
          </ul>
          <Link href="/contact-us" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-brand-600">
            Support Center <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-5 text-sm text-slate-500 md:flex-row">
          <p>{settings.footer_copyright.split("{year}").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <Year />}</span>)}</p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {(footer.footer_legal ?? []).map((l) => (
              <li key={l.id}>
                {l.external ? (
                  <a href={l.href} className="hover:text-white">{l.label}</a>
                ) : (
                  <Link href={l.href} className="hover:text-white">{l.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">{title}</h3>
      <ul className="mt-5 space-y-2.5 text-[15px]">
        {items.map((i) => (
          <li key={i.id}>
            {i.external || i.href.startsWith("http") ? (
              <a href={i.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 transition hover:text-white">
                {i.label} <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
            ) : (
              <Link href={i.href} className="text-slate-400 transition hover:text-white">{i.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
