import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Link as LinkT } from "@/lib/blocks/types";
import { cn } from "@/lib/utils";

export function CtaButton({ link, size = "lg", className, fallbackVariant }: { link?: LinkT | null; size?: "sm" | "md" | "lg" | "xl"; className?: string; fallbackVariant?: LinkT["variant"] }) {
  if (!link?.label || !link?.href) return null;
  return (
    <Button href={link.href} variant={link.variant || fallbackVariant || "primary"} size={size} className={className}>
      {link.label} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

export function CtaRow({ links, className, invert }: { links?: (LinkT | undefined | null)[]; className?: string; invert?: boolean }) {
  const list = (links || []).filter((l): l is LinkT => !!l?.label && !!l?.href);
  if (!list.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {list.map((l, i) => (
        <CtaButton key={i} link={l} fallbackVariant={i === 0 ? (invert ? "white" : "primary") : invert ? "ghost" : "outline"} className={invert && i > 0 ? "text-white hover:bg-white/10" : undefined} />
      ))}
    </div>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5 transition-all", className)}>
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
