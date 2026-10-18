import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { sql } from "@/lib/db";
import { Container, Section, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="h-section">Search iCET</h1>
        <Suspense fallback={<div className="skeleton mt-6 h-12" />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </Container>
    </Section>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const rows = q.length >= 2 ? await sql<{ kind: string; title: string; url: string; snippet: string }[]>`select kind, title, url, snippet from public.site_search(${q}, 30)` : [];
  return (
    <>
      <form action="/search" className="mt-6 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Search programmes, events, articles…" aria-label="Search" />
        <Button type="submit"><SearchIcon className="h-4 w-4" /> Search</Button>
      </form>
      {q && (
        <p className="mt-6 text-sm text-slate-500">{rows.length} result{rows.length === 1 ? "" : "s"} for “{q}”</p>
      )}
      <ul className="mt-4 divide-y divide-slate-200">
        {rows.map((r) => (
          <li key={r.url + r.title} className="py-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">{r.kind}</span>
            <Link href={r.url} className="block font-display text-lg font-bold text-slate-900 hover:text-brand-700">{r.title}</Link>
            {r.snippet && <p className="mt-1 text-sm text-slate-600">{r.snippet}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
