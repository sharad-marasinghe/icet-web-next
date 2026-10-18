/**
 * Server-side normalisation of a submitted blocks array: drops unknown block
 * types, guarantees ids, and sanitises every rich-text field (recursively through
 * list fields) with the shared HTML sanitiser.
 */
import { BLOCK_REGISTRY, type FieldSpec } from "@/lib/blocks/registry";
import { newBlockId, type Block, type BlockSettings, type Tone } from "@/lib/blocks/types";
import { sanitizeHtml } from "@/lib/sanitize";

const TONES: Tone[] = ["white", "light", "navy", "brand", "gradient", "grid"];

function cleanData(fields: FieldSpec[], data: unknown): Record<string, unknown> {
  const d = (data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>) } : {}) as Record<string, unknown>;
  for (const f of fields) {
    const v = d[f.key];
    if (v === undefined) continue;
    if (f.type === "richtext") d[f.key] = typeof v === "string" ? sanitizeHtml(v) : undefined;
    else if (f.type === "list") d[f.key] = Array.isArray(v) ? v.slice(0, f.max || 200).map((item) => cleanData(f.fields, item)) : undefined;
    if (d[f.key] === undefined) delete d[f.key];
  }
  return d;
}

function cleanSettings(s: unknown): BlockSettings | undefined {
  if (!s || typeof s !== "object") return undefined;
  const src = s as Record<string, unknown>;
  const out: BlockSettings = {};
  if (typeof src.tone === "string" && TONES.includes(src.tone as Tone)) out.tone = src.tone as Tone;
  if (typeof src.anchor === "string" && src.anchor.trim()) out.anchor = src.anchor.trim().slice(0, 80);
  if (src.hidden === true) out.hidden = true;
  if (src.size === "sm") out.size = "sm";
  if (typeof src.className === "string" && src.className.trim()) out.className = src.className.trim().slice(0, 200);
  return Object.keys(out).length ? out : undefined;
}

export function cleanBlocks(input: unknown): Block[] | null {
  if (!Array.isArray(input)) return null;
  const out: Block[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const type = typeof b.type === "string" ? b.type : "";
    const def = BLOCK_REGISTRY[type as keyof typeof BLOCK_REGISTRY];
    if (!def) continue;
    const block = { id: typeof b.id === "string" && b.id ? b.id.slice(0, 40) : newBlockId(), type: def.type, data: cleanData(def.fields, b.data) } as Block;
    const settings = cleanSettings(b.settings);
    if (settings) block.settings = settings;
    out.push(block);
  }
  return out;
}
