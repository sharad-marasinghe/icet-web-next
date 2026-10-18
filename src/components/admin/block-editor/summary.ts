import type { Block } from "@/lib/blocks/types";
import { stripHtml } from "@/lib/utils";

/** One-line description of a block for the block list. */
export function blockSummary(block: Block): string {
  const d = block.data as Record<string, unknown>;
  const pick = (k: string) => (typeof d[k] === "string" && (d[k] as string).trim() ? (d[k] as string) : "");
  const s = pick("title") || pick("eyebrow") || pick("name") || pick("quote") || pick("subtitle") || (typeof d.html === "string" ? stripHtml(d.html) : "") || (typeof d.kind === "string" ? `Form: ${d.kind}` : "") || (typeof d.group_slug === "string" ? `Group: ${d.group_slug}` : "") || (typeof d.collection === "string" ? `Collection: ${d.collection}` : "");
  const items = Array.isArray(d.items) ? d.items.length : Array.isArray(d.levels) ? d.levels.length : Array.isArray(d.groups) ? d.groups.length : 0;
  const text = s.length > 70 ? s.slice(0, 69).trimEnd() + "…" : s;
  if (text) return items ? `${text} · ${items} item${items === 1 ? "" : "s"}` : text;
  return items ? `${items} item${items === 1 ? "" : "s"}` : "No content yet";
}
