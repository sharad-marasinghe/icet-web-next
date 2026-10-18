"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X, FileText, CalendarDays, Newspaper, GraduationCap, UserRound, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Hit = { kind: string; title: string; url: string; snippet: string; image_url: string | null };

const icons: Record<string, React.ElementType> = { page: FileText, event: CalendarDays, post: Newspaper, program: GraduationCap, trainer: UserRound };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (open) inputRef.current?.focus();
      else {
        setQ("");
        setHits([]);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setHits([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  if (!open) return null;
  const quick = [
    { label: "Apply Now", url: "/apply" },
    { label: "Programmes", url: "/professional-it-courses-in-sri-lanka" },
    { label: "Verify Certificate", url: "/verify-certificate" },
    { label: "Events", url: "/events" },
    { label: "Contact", url: "/contact-us" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/50 p-4 pt-[10vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Site search" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-elev animate-fade-up" style={{ animationDuration: ".25s" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search programmes, events, articles…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
            aria-label="Search"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close search">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <div className="p-3">
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Quick links</p>
              <div className="flex flex-wrap gap-2">
                {quick.map((x) => (
                  <Link key={x.url} href={x.url} onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700">
                    {x.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : hits.length === 0 && !loading ? (
            <p className="p-6 text-center text-sm text-slate-500">No results for “{q}”. Try a different keyword or <Link href="/contact-us" className="text-brand-600 underline" onClick={onClose}>contact us</Link>.</p>
          ) : (
            <ul>
              {hits.map((h) => {
                const Icon = icons[h.kind] ?? FileText;
                return (
                  <li key={h.url + h.title}>
                    <Link href={h.url} onClick={onClose} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-50">
                      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-brand-600")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-slate-900">{h.title}</span>
                        {h.snippet && <span className="block truncate text-sm text-slate-500">{h.snippet}</span>}
                      </span>
                      <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h.kind}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
