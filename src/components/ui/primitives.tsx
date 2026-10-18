import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children, as: Tag = "div" }: { className?: string; children: React.ReactNode; as?: React.ElementType }) {
  return <Tag className={cn("container-x", className)}>{children}</Tag>;
}

export type Tone = "white" | "light" | "navy" | "brand" | "gradient" | "grid";
const tones: Record<Tone, string> = {
  white: "bg-white",
  light: "bg-surface",
  navy: "bg-navy text-white",
  brand: "bg-brand-600 text-white",
  gradient: "bg-hero text-white",
  grid: "bg-white bg-grid",
};

export function Section({
  tone = "white",
  className,
  children,
  id,
  size = "md",
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  id?: string;
  size?: "sm" | "md";
}) {
  return (
    <section id={id} className={cn(size === "sm" ? "section-y-sm" : "section-y", tones[tone], "relative overflow-hidden", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  invert,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  invert?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "", className)}>
      {eyebrow && <p className={cn("eyebrow mb-3", invert && "text-brand-300")}>{eyebrow}</p>}
      <Tag className={cn("h-section text-balance", invert && "text-white")}>{title}</Tag>
      {description && <p className={cn("mt-4 text-lg text-slate-600 text-pretty", invert && "text-slate-300")}>{description}</p>}
    </div>
  );
}

export function Badge({ children, tone = "brand", className }: { children: React.ReactNode; tone?: "brand" | "green" | "amber" | "slate" | "rose" | "white"; className?: string }) {
  const t = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    green: "bg-green-50 text-green-700 ring-green-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    white: "bg-white/15 text-white ring-white/20 backdrop-blur",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", t, className)}>{children}</span>;
}

export function Card({ className, children, hover }: { className?: string; children: React.ReactNode; hover?: boolean }) {
  return <div className={cn("card", hover && "card-hover", className)}>{children}</div>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ children, htmlFor, required, className, hint }: { children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string; hint?: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-semibold text-slate-800", className)}>
      {children}
      {required && <span className="ml-1 text-rose-600" aria-hidden>*</span>}
      {hint && <span className="ml-2 font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

export function Field({ label, htmlFor, required, hint, error, children, className }: { label?: React.ReactNode; htmlFor?: string; required?: boolean; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <Label htmlFor={htmlFor} required={required} hint={hint}>{label}</Label>}
      {children}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode; className?: string }) {
  const t = {
    info: "bg-brand-50 text-brand-800 border-brand-200",
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-[var(--radius)] border px-4 py-3 text-sm", t, className)}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-slate-200", className)} />;
}

export function IconBox({ children, className, tone = "brand" }: { children: React.ReactNode; className?: string; tone?: "brand" | "green" | "navy" | "white" }) {
  const t = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-green-50 text-green-600",
    navy: "bg-navy text-white",
    white: "bg-white/15 text-white",
  }[tone];
  return <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-xl", t, className)}>{children}</div>;
}
