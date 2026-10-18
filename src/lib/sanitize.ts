/**
 * Minimal HTML sanitiser for admin-authored rich text. Allows a conservative
 * tag/attribute whitelist, strips scripts/styles/event handlers and dangerous URLs.
 * Works in Node and the browser (no DOM dependency).
 */
const ALLOWED_TAGS = new Set([
  "p","br","strong","b","em","i","u","s","a","ul","ol","li","h1","h2","h3","h4","h5","h6","blockquote","code","pre",
  "img","figure","figcaption","table","thead","tbody","tr","th","td","span","div","hr","iframe","sup","sub","mark","small",
]);
const ALLOWED_ATTR: Record<string, Set<string>> = {
  a: new Set(["href","title","target","rel"]),
  img: new Set(["src","alt","title","width","height","loading"]),
  iframe: new Set(["src","width","height","allow","allowfullscreen","frameborder","title"]),
  td: new Set(["colspan","rowspan"]), th: new Set(["colspan","rowspan"]),
  "*": new Set(["class","id","style"]),
};
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;
const IFRAME_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.google\.com\/maps|maps\.google\.com|docs\.google\.com|forms\.gle)/i;

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<(script|style|object|embed|applet|meta|link|base|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<(script|style|object|embed|applet|meta|link|base|input)\b[^>]*\/?>/gi, "");
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;
    const attrs: string[] = [];
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawAttrs))) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? "";
      if (name.startsWith("on")) continue;
      const allowed = ALLOWED_ATTR[tag]?.has(name) || ALLOWED_ATTR["*"].has(name);
      if (!allowed) continue;
      if ((name === "href" || name === "src") && !SAFE_URL.test(value.trim())) continue;
      if (tag === "iframe" && name === "src" && !IFRAME_HOSTS.test(value.trim())) return "";
      if (name === "style" && /expression|javascript:|url\(/i.test(value)) continue;
      attrs.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }
    if (tag === "a") {
      const hasTarget = attrs.some((a) => a.startsWith("target="));
      if (hasTarget) attrs.push('rel="noopener noreferrer"');
    }
    const selfClosing = tag === "br" || tag === "img" || tag === "hr";
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}${selfClosing ? " /" : ""}>`;
  });
}

/** Inline-only subset for form field descriptions (bold, italic, links, line breaks). */
export function sanitizeInline(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input).replace(/<\/?(p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|img|iframe|figure|figcaption|pre|blockquote|hr)\b[^>]*>/gi, (m) =>
    /^<\/?(p|div|li|h[1-6])/i.test(m) && m.startsWith("</") ? "<br>" : "",
  );
}
