"use client";

import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

/** Client-side lucide icon lookup by PascalCase name (falls back to Sparkles). */
export function BlockIcon({ name, ...props }: { name?: string | null } & LucideProps) {
  const key = (name || "Sparkles") as keyof typeof Icons;
  const Cmp = (Icons[key] as React.ComponentType<LucideProps> | undefined) || Icons.Sparkles;
  return <Cmp {...props} />;
}
