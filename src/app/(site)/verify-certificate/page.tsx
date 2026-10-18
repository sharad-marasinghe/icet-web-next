import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck, Lock, Clock3, Mail } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { Container, Section } from "@/components/ui/primitives";
import { VerifyCertificate } from "@/components/forms/verify-certificate";
import { buildMetadata, breadcrumbJsonLd, JsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata(s, { title: "Verify a Certificate – iCET Certificate Verification Portal", description: "Verify the authenticity of certificates issued by iCET - Institute of Computer Engineering Technology. Enter the certificate code to view the verified record.", path: "/verify-certificate" });
}

export default function VerifyPage({ searchParams }: PageProps<"/verify-certificate">) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Verify Certificate", path: "/verify-certificate" }])} />
      <section className="relative overflow-hidden bg-hero py-16 text-white md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <Container className="relative max-w-3xl text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20"><ShieldCheck className="h-8 w-8 text-accent-500" /></span>
          <h1 className="h-display mt-6 text-white">Certificate Verification</h1>
          <p className="mt-4 text-lg text-slate-200">Welcome to the iCET Certificate Verification Portal. Enter the certificate code printed on the certificate (or scan its QR code) to confirm its authenticity.</p>
        </Container>
      </section>
      <Section>
        <Container className="max-w-4xl">
          <Suspense fallback={<div className="skeleton h-20" />}>
            <Verifier searchParams={searchParams} />
          </Suspense>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { Icon: Lock, t: "Privacy protected", d: "To protect certificate holders, some personal information may be partially masked. Results confirm validity only." },
              { Icon: Clock3, t: "Updated regularly", d: "Recently issued certificates may take a short time to appear. Try again later if your code is not found yet." },
              { Icon: Mail, t: "Need help?", d: "Contact the iCET administration team at info@icet.lk or +94 705 805 805 for assistance." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="card p-6">
                <Icon className="h-6 w-6 text-brand-600" />
                <h2 className="mt-3 font-display text-lg font-bold text-slate-900">{t}</h2>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

async function Verifier({ searchParams }: { searchParams: PageProps<"/verify-certificate">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : typeof sp.code === "string" ? sp.code : undefined;
  return <VerifyCertificate initialCode={id} />;
}
