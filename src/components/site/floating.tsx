"use client";

import * as React from "react";
import { MessageCircle, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingActions({ whatsapp, message }: { whatsapp: string; message: string }) {
  const [showTop, setShowTop] = React.useState(false);
  const [bubble, setBubble] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => setBubble(true), 6000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);
  const href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn("grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-card ring-1 ring-slate-200 transition hover:text-brand-700", showTop ? "opacity-100" : "pointer-events-none opacity-0")}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
      <div className="flex items-end gap-3">
        {bubble && (
          <div className="relative hidden max-w-[220px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-elev ring-1 ring-slate-200 sm:block animate-fade-up">
            <button type="button" onClick={() => setBubble(false)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-white" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
            👋 Questions about admissions? Chat with a counsellor on WhatsApp.
          </div>
        )}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-8px_rgb(37,211,102,0.8)] transition hover:scale-105"
          aria-label="Chat on WhatsApp"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40" aria-hidden />
          <MessageCircle className="relative h-7 w-7" />
        </a>
      </div>
    </div>
  );
}

export function AnnouncementBar({ text, linkLabel, linkUrl, tone = "brand" }: { text: string; linkLabel?: string; linkUrl?: string; tone?: "brand" | "navy" | "green" }) {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        setHidden(sessionStorage.getItem("icet-announce") === text);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [text]);
  if (hidden || !text) return null;
  const bg = { brand: "bg-brand-600", navy: "bg-navy", green: "bg-accent-600" }[tone];
  return (
    <div className={cn("relative z-50 text-white", bg)}>
      <div className="container-x flex items-center justify-center gap-3 py-2 text-center text-sm font-medium">
        <span>{text}</span>
        {linkUrl && (
          <a href={linkUrl} className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold hover:bg-white/25">{linkLabel || "Learn more"}</a>
        )}
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try { sessionStorage.setItem("icet-announce", text); } catch {}
          }}
          className="absolute right-3 grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
