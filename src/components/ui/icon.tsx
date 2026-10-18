import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

/** Server-side icon lookup by lucide name. Falls back to Sparkles. */
export function Icon({ name, ...props }: { name?: string | null } & LucideProps) {
  const key = (name || "Sparkles") as keyof typeof Icons;
  const Cmp = (Icons[key] as React.ComponentType<LucideProps>) || Icons.Sparkles;
  return <Cmp {...props} />;
}
