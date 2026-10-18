import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Section tone="light">
      <Container className="max-w-2xl text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-brand-50 text-brand-600"><Compass className="h-10 w-10" /></span>
        <p className="eyebrow mt-8">Error 404</p>
        <h1 className="h-section mt-2">We couldn&apos;t find that page</h1>
        <p className="mt-4 text-lg text-slate-600">The page may have moved or no longer exists. Try searching, or head back to the homepage.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/"><Home className="h-4 w-4" /> Go home</Button>
          <Button href="/search" variant="outline"><Search className="h-4 w-4" /> Search the site</Button>
          <Button href="/professional-it-courses-in-sri-lanka" variant="ghost">Explore programmes</Button>
        </div>
        <p className="mt-10 text-sm text-slate-500">Need help? <Link href="/contact-us" className="text-brand-700 underline">Contact us</Link></p>
      </Container>
    </Section>
  );
}
