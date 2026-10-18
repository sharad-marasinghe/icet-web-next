"use client";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/primitives";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Section tone="light">
      <Container className="max-w-xl text-center">
        <h1 className="h-section">Something went wrong</h1>
        <p className="mt-4 text-slate-600">Please try again. If the problem continues, contact us at info@icet.lk.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><Button href="/" variant="outline">Go home</Button></div>
      </Container>
    </Section>
  );
}
