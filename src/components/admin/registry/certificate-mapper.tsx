"use client";

import * as React from "react";
import { Plus, Trash2, FileDown, Send, Crosshair, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AInput, ASelect, AField, useToast, type ActionState } from "@/components/admin/ui";
import { ImageField, MediaPickerButton } from "@/components/admin/media-picker";
import type { MappingItem } from "@/lib/registry/pdf";
import { MAPPING_VARS, SAMPLE_CERT_VALUES, DEFAULT_MAPPING_ITEM } from "./shared";

export type CertificateMapperProps = {
  /** Hidden input names for the template URL and the mapping JSON. */
  templateName: string;
  mappingName: string;
  initialTemplateUrl: string;
  initialMapping: MappingItem[];
  /** Used as the sample course name. */
  workshopTitle?: string;
  /** Server action that builds a sample PDF and emails it. */
  onSendTest: (input: { template_url: string; mapping: MappingItem[]; to: string }) => Promise<ActionState>;
};

const FONT_STACK = "Helvetica, Arial, sans-serif";

export function CertificateMapper({ templateName, mappingName, initialTemplateUrl, initialMapping, workshopTitle, onSendTest }: CertificateMapperProps) {
  const toast = useToast();
  const [template, setTemplate] = React.useState(initialTemplateUrl || "");
  const [items, setItems] = React.useState<MappingItem[]>(() => (Array.isArray(initialMapping) ? initialMapping.map((m) => ({ ...m })) : []));
  const [active, setActive] = React.useState<number | null>(items.length ? 0 : null);
  const [loaded, setLoaded] = React.useState<{ url: string; img: HTMLImageElement | null; error: boolean }>({ url: "", img: null, error: false });
  const img = loaded.url === template ? loaded.img : null;
  const imgError = loaded.url === template && loaded.error;
  const [sigImgs, setSigImgs] = React.useState<Record<string, HTMLImageElement>>({});
  const [width, setWidth] = React.useState(800);
  const [testTo, setTestTo] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "pdf" | "mail">("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drag = React.useRef<{ index: number; dx: number; dy: number } | null>(null);
  const values = React.useMemo(() => ({ ...SAMPLE_CERT_VALUES, course_name: workshopTitle || SAMPLE_CERT_VALUES.course_name }), [workshopTitle]);

  // Load template image.
  React.useEffect(() => {
    if (!template) return;
    let alive = true;
    const el = new window.Image();
    el.onload = () => { if (alive) setLoaded({ url: template, img: el, error: false }); };
    el.onerror = () => { if (alive) setLoaded({ url: template, img: null, error: true }); };
    el.src = template;
    return () => { alive = false; };
  }, [template]);
  // Load signature images.
  React.useEffect(() => {
    for (const it of items) {
      if (it.var_key !== "signature" || !it.image_url || sigImgs[it.image_url]) continue;
      const url = it.image_url;
      const el = new window.Image();
      el.onload = () => setSigImgs((s) => ({ ...s, [url]: el }));
      el.src = url;
    }
  }, [items, sigImgs]);
  // Track container width.
  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setWidth(Math.max(200, Math.floor(e.contentRect.width))); });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const natW = img?.naturalWidth || 1754, natH = img?.naturalHeight || 1240;
  const scale = width / natW;
  const canvasH = Math.round(natH * scale);

  const fontFor = React.useCallback((m: MappingItem) => `${m.font_weight === "italic" ? "italic " : ""}${m.font_weight === "bold" ? "bold " : ""}${(m.font_size || 24) * scale}px ${FONT_STACK}`, [scale]);
  const textFor = React.useCallback((m: MappingItem) => String((values as Record<string, string>)[m.var_key] ?? ""), [values]);

  // Bounding box in canvas px for hit testing.
  const bbox = React.useCallback((ctx: CanvasRenderingContext2D, m: MappingItem) => {
    const x = m.x * scale, y = m.y * scale;
    if (m.var_key === "signature") {
      const w = (m.width || 300) * scale;
      const s = m.image_url ? sigImgs[m.image_url] : undefined;
      const h = (m.height ? m.height : s ? (s.naturalHeight / s.naturalWidth) * (m.width || 300) : (m.width || 300) * 0.4) * scale;
      return { x: x - w / 2, y: y - h / 2, w, h };
    }
    ctx.font = fontFor(m);
    const w = ctx.measureText(textFor(m)).width;
    const h = (m.font_size || 24) * scale;
    const align = m.align || (m.var_key === "student_name" ? "center" : "left");
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    return { x: left, y: y - h, w, h: h * 1.25 };
  }, [scale, sigImgs, fontFor, textFor]);

  // Draw.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = canvasH * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${canvasH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, canvasH);
    if (img) ctx.drawImage(img, 0, 0, width, canvasH);
    else {
      ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, width, canvasH);
      ctx.strokeStyle = "#cbd5e1"; ctx.setLineDash([6, 6]); ctx.strokeRect(1, 1, width - 2, canvasH - 2); ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8"; ctx.font = `600 14px ${FONT_STACK}`; ctx.textAlign = "center";
      ctx.fillText(imgError ? "Template image could not be loaded" : "Choose a template image to start mapping", width / 2, canvasH / 2);
    }
    items.forEach((m, i) => {
      const x = m.x * scale, y = m.y * scale;
      if (m.var_key === "signature") {
        const b = bbox(ctx, m);
        const s = m.image_url ? sigImgs[m.image_url] : undefined;
        if (s) ctx.drawImage(s, b.x, b.y, b.w, b.h);
        else { ctx.fillStyle = "rgba(4,107,210,0.08)"; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = "#046bd2"; ctx.font = `600 12px ${FONT_STACK}`; ctx.textAlign = "center"; ctx.fillText("Signature", x, y + 4); }
      } else {
        ctx.font = fontFor(m);
        ctx.fillStyle = m.font_color || "#000";
        ctx.textAlign = (m.align || (m.var_key === "student_name" ? "center" : "left")) as CanvasTextAlign;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(textFor(m), x, y);
      }
      if (i === active) {
        const b = bbox(ctx, m);
        ctx.strokeStyle = "#046bd2"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.setLineDash([]);
        ctx.fillStyle = "#046bd2"; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }, [img, imgError, items, active, width, canvasH, scale, sigImgs, bbox, fontFor, textFor]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { cx, cy } = pos(e);
    for (let i = items.length - 1; i >= 0; i--) {
      const b = bbox(ctx, items[i]);
      if (cx >= b.x - 4 && cx <= b.x + b.w + 4 && cy >= b.y - 4 && cy <= b.y + b.h + 4) {
        setActive(i);
        drag.current = { index: i, dx: cx - items[i].x * scale, dy: cy - items[i].y * scale };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (active !== null && items[active]) {
      setItems((list) => list.map((m, i) => (i === active ? { ...m, x: Math.round(cx / scale), y: Math.round(cy / scale) } : m)));
      drag.current = { index: active, dx: 0, dy: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const { cx, cy } = pos(e);
    const nx = Math.round(Math.min(natW, Math.max(0, (cx - d.dx) / scale)));
    const ny = Math.round(Math.min(natH, Math.max(0, (cy - d.dy) / scale)));
    setItems((list) => list.map((m, i) => (i === d.index ? { ...m, x: nx, y: ny } : m)));
  };
  const onUp = () => { drag.current = null; };

  const patch = (i: number, p: Partial<MappingItem>) => setItems((list) => list.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const add = (var_key: string) => {
    const item: MappingItem = { var_key, ...DEFAULT_MAPPING_ITEM, x: Math.round(natW / 2), y: Math.round(natH / 2) };
    if (var_key === "signature") { item.width = 300; item.align = "center"; }
    if (var_key === "certificate_id") { item.font_size = 20; item.font_weight = "normal"; item.align = "left"; }
    if (var_key === "issue_date") { item.font_size = 18; item.font_weight = "normal"; }
    setItems((l) => [...l, item]);
    setActive(items.length);
  };
  const remove = (i: number) => { setItems((l) => l.filter((_, j) => j !== i)); setActive(null); };

  const previewPdf = async () => {
    setBusy("pdf");
    try {
      const res = await fetch("/admin/api/registry/certificate-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_url: template, mapping: items, values }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Preview failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast({ tone: "error", message: e instanceof Error ? e.message : "Preview failed" });
    } finally { setBusy(""); }
  };
  const sendTest = async () => {
    setBusy("mail");
    try {
      const r = await onSendTest({ template_url: template, mapping: items, to: testTo });
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" });
    } finally { setBusy(""); }
  };

  const unused = Object.keys(MAPPING_VARS).filter((k) => k === "signature" || !items.some((m) => m.var_key === k));

  return (
    <div className="space-y-4">
      <input type="hidden" name={templateName} value={template} />
      <input type="hidden" name={mappingName} value={JSON.stringify(items)} />
      <ImageField label="Certificate template image" value={template} onChange={setTemplate} hint="A high-resolution PNG or JPG (e.g. A4 landscape at 150–300 dpi). Coordinates below are in this image's pixels." />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div>
          <div ref={wrapRef} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className={cn("block touch-none", active !== null ? "cursor-crosshair" : "cursor-default")} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Crosshair className="h-3.5 w-3.5" /> Select an item, then click on the canvas to place it or drag it into position. {img && <span>Image: {natW}×{natH}px.</span>}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={previewPdf} loading={busy === "pdf"}><FileDown className="h-4 w-4" /> Preview PDF</Button>
            <div className="flex items-center gap-2">
              <AInput type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send test certificate to…" className="h-9 w-56" />
              <Button type="button" size="sm" variant="outline" onClick={sendTest} disabled={!testTo} loading={busy === "mail"}><Send className="h-4 w-4" /> Send test certificate email</Button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Mapped items</p>
            <ASelect className="h-9 w-auto text-xs" value="" onChange={(e) => { if (e.target.value) add(e.target.value); }}>
              <option value="">+ Add item…</option>
              {unused.map((k) => <option key={k} value={k}>{MAPPING_VARS[k]}</option>)}
            </ASelect>
          </div>
          {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Nothing mapped. Add the student name and certificate ID to begin.</p>}
          {items.map((m, i) => (
            <div key={i} className={cn("rounded-xl border p-3", active === i ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-100" : "border-slate-200 bg-white")} onClick={() => setActive(i)}>
              <div className="mb-2 flex items-center gap-2">
                <ASelect className="h-8 text-xs" value={m.var_key} onChange={(e) => patch(i, { var_key: e.target.value })}>
                  {Object.entries(MAPPING_VARS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </ASelect>
                <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <AField label="X"><AInput type="number" className="h-8 text-xs" value={m.x} onChange={(e) => patch(i, { x: Number(e.target.value) || 0 })} /></AField>
                <AField label="Y"><AInput type="number" className="h-8 text-xs" value={m.y} onChange={(e) => patch(i, { y: Number(e.target.value) || 0 })} /></AField>
                {m.var_key === "signature" ? (
                  <>
                    <AField label="Width (px)"><AInput type="number" className="h-8 text-xs" value={m.width || 300} onChange={(e) => patch(i, { width: Number(e.target.value) || 300 })} /></AField>
                    <div className="col-span-2">
                      <p className="mb-1 text-sm font-semibold text-slate-700">Signature image</p>
                      <div className="flex items-center gap-2">
                        <MediaPickerButton onSelect={(url) => patch(i, { image_url: url })} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-brand-400"><ImageIcon className="h-3.5 w-3.5" /> Choose</MediaPickerButton>
                        <span className="truncate text-[11px] text-slate-500">{m.image_url ? m.image_url.split("/").pop() : "No image selected"}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AField label="Font size"><AInput type="number" min={6} max={400} className="h-8 text-xs" value={m.font_size || 24} onChange={(e) => patch(i, { font_size: Number(e.target.value) || 24 })} /></AField>
                    <AField label="Colour"><input type="color" value={m.font_color || "#000000"} onChange={(e) => patch(i, { font_color: e.target.value })} className="h-8 w-full cursor-pointer rounded-md border border-slate-300 bg-white" /></AField>
                    <AField label="Weight">
                      <ASelect className="h-8 text-xs" value={m.font_weight || "normal"} onChange={(e) => patch(i, { font_weight: e.target.value as MappingItem["font_weight"] })}>
                        <option value="normal">Normal</option><option value="bold">Bold</option><option value="italic">Italic</option>
                      </ASelect>
                    </AField>
                    <AField label="Align">
                      <ASelect className="h-8 text-xs" value={m.align || (m.var_key === "student_name" ? "center" : "left")} onChange={(e) => patch(i, { align: e.target.value as MappingItem["align"] })}>
                        <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
                      </ASelect>
                    </AField>
                  </>
                )}
              </div>
            </div>
          ))}
          {unused.length > 0 && items.length > 0 && (
            <button type="button" onClick={() => add(unused[0])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Plus className="h-3.5 w-3.5" /> Add {MAPPING_VARS[unused[0]].toLowerCase()}</button>
          )}
        </div>
      </div>
    </div>
  );
}
