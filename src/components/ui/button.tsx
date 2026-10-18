import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "white" | "danger" | "accent" | "link";
type Size = "sm" | "md" | "lg" | "xl" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius)] transition-all duration-200 select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-[0_8px_24px_-8px_rgb(4,107,210,0.6)] hover:bg-brand-700 hover:shadow-[0_10px_28px_-8px_rgb(4,107,210,0.7)] active:translate-y-px",
  secondary: "bg-navy text-white hover:bg-brand-900 active:translate-y-px",
  outline: "border border-slate-300 bg-white text-slate-800 hover:border-brand-600 hover:text-brand-700 hover:bg-brand-50",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
  white: "bg-white text-brand-700 hover:bg-brand-50 shadow-sm",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  accent: "bg-accent-600 text-white hover:bg-green-700 shadow-[0_8px_24px_-8px_rgb(22,163,74,0.6)]",
  link: "text-brand-600 underline-offset-4 hover:underline px-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-8 text-base",
  icon: "h-10 w-10 p-0",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
  external?: boolean;
  loading?: boolean;
};

export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string }) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", href, external, loading, children, ...props },
  ref,
) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (href) {
    const isExternal = external ?? /^(https?:|mailto:|tel:)/.test(href);
    if (isExternal) {
      return (
        <a href={href} className={classes} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
