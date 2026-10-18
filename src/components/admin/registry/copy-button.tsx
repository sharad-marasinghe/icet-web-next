"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label = "Copy", className, size = "sm" }: { value: string; label?: string; className?: string; size?: "sm" | "xs" }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
      }}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700", size === "sm" ? "h-8 px-2.5 text-xs" : "h-7 px-2 text-[11px]", className)}
      title={label}
    >
      {done ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}
