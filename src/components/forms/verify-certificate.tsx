"use client";

import * as React from "react";
import { Search, Loader2, ShieldCheck, ShieldAlert, Download, FileDown, Share2 } from "lucide-react";
import { Linkedin } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

type Mapping = { var_key: string; x: number; y: number; font_size?: number; font_color?: string; font_weight?: string; align?: string; image_url?: string; width?: number; height?: number };
type Result =
  | { valid: true; student_name: string; student_id: string; student_nic: string; course_name: string; certificate_code: string; issue_date: string; template_url: string | null; certificate_mapping: Mapping[]; pdf_url: string | null }
  | { valid: false; is_suspended?: boolean; suspension_reason?: string | null; message: string };

export function VerifyCertificate({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = React.useState(initialCode || "");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = React.useState(false);

  const verify = React.useCallback(async (c: string) => {
    const v = c.trim();
    if (!v) return;
    setLoading(true);
    setResult(null);
    setCanvasReady(false);
    try {
      const res = await fetch(`/api/verify?id=${encodeURIComponent(v)}`, { cache: "no-store" });
      const data = (await res.json()) as Result;
      setResult(data);
      const url = new URL(window.location.href);
      url.searchParams.set("id", v);
      window.history.replaceState(null, "", url.toString());
    } catch {
      setResult({ valid: false, message: "Could not reach the verification service. Please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialCode) return;
    const t = setTimeout(() => verify(initialCode), 0);
    return () => clearTimeout(t);
  }, [initialCode, verify]);

  // Render the certificate preview on canvas (mirrors the PDF layout).
  React.useEffect(() => {
    if (!result || !result.valid || !result.template_url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bg = new window.Image();
    bg.crossOrigin = "anonymous";
    bg.onload = async () => {
      canvas.width = bg.naturalWidth;
      canvas.height = bg.naturalHeight;
      ctx.drawImage(bg, 0, 0);
      const values: Record<string, string> = { student_name: result.student_name, certificate_id: result.certificate_code, student_id: result.student_id, student_nic: result.student_nic, issue_date: formatDate(result.issue_date), course_name: result.course_name };
      for (const m of result.certificate_mapping || []) {
        if (m.var_key === "signature" && m.image_url) {
          await new Promise<void>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => { const w = m.width || 300; const h = m.height || (img.naturalHeight / img.naturalWidth) * w; ctx.drawImage(img, m.x - w / 2, m.y - h / 2, w, h); resolve(); };
            img.onerror = () => resolve();
            img.src = m.image_url!;
          });
          continue;
        }
        const text = values[m.var_key] || "";
        if (!text) continue;
        const weight = m.font_weight === "bold" ? "bold " : m.font_weight === "italic" ? "italic " : "";
        ctx.font = `${weight}${m.font_size || 24}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = m.font_color || "#000";
        ctx.textAlign = (m.align as CanvasTextAlign) || (m.var_key === "student_name" ? "center" : "left");
        ctx.textBaseline = "alphabetic";
        ctx.fillText(text, m.x, m.y);
      }
      setCanvasReady(true);
    };
    bg.src = result.template_url;
  }, [result]);

  const downloadPng = () => {
    const c = canvasRef.current;
    if (!c || !result?.valid) return;
    const a = document.createElement("a");
    a.download = `${result.certificate_code}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  const linkedin = result?.valid
    ? (() => {
        const d = new Date(result.issue_date);
        const p = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: result.course_name, organizationName: "iCET - Institute of Computer Engineering Technology", issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: `${window.location.origin}/verify-certificate?id=${encodeURIComponent(result.certificate_code)}`, certId: result.certificate_code });
        return `https://www.linkedin.com/profile/add?${p.toString()}`;
      })()
    : null;

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); verify(code); }} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter certificate code, e.g. ICET-AI-WS-116E9F94"
            className="h-13 w-full rounded-[var(--radius)] border border-slate-300 pl-12 pr-4 font-mono text-[15px] uppercase tracking-wide outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            aria-label="Certificate code"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !code.trim()} className="sm:w-40">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5" /> Verify</>}
        </Button>
      </form>

      {result && !result.valid && (
        <Notice tone={result.is_suspended ? "warning" : "error"} className="flex items-start gap-3 text-base">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{result.is_suspended ? "Certificate suspended" : "Not verified"}</p>
            <p className="text-sm">{result.message}</p>
          </div>
        </Notice>
      )}

      {result?.valid && (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-4 bg-green-600 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20"><ShieldCheck className="h-7 w-7" /></span>
              <div>
                <p className="font-display text-xl font-bold">Certificate verified</p>
                <p className="text-sm text-green-50">Issued by iCET – Institute of Computer Engineering Technology</p>
              </div>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 font-mono text-sm">{result.certificate_code}</span>
          </div>
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1.4fr] lg:p-8">
            <dl className="space-y-4">
              {[
                ["Student name", result.student_name],
                ["Student ID", result.student_id],
                result.student_nic ? ["NIC", result.student_nic] : null,
                ["Course / Workshop", result.course_name],
                ["Certificate code", result.certificate_code],
                ["Issue date", formatDate(result.issue_date)],
              ].filter(Boolean).map((row) => (
                <div key={(row as string[])[0]} className="border-b border-slate-100 pb-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{(row as string[])[0]}</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{(row as string[])[1]}</dd>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                {result.pdf_url && <Button href={result.pdf_url} variant="primary" size="md"><FileDown className="h-4 w-4" /> Download PDF</Button>}
                {result.template_url && <Button onClick={downloadPng} variant="outline" size="md" disabled={!canvasReady}><Download className="h-4 w-4" /> Download PNG</Button>}
                {linkedin && (
                  <a href={linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-[var(--radius)] bg-[#0A66C2] px-5 text-[15px] font-semibold text-white hover:bg-[#004182]">
                    <Linkedin className="h-4 w-4" /> Add to LinkedIn
                  </a>
                )}
                <Button variant="ghost" size="md" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 className="h-4 w-4" /> Copy link</Button>
              </div>
            </dl>
            <div>
              {result.template_url ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-card">
                  <canvas ref={canvasRef} className="h-auto w-full" aria-label="Certificate preview" />
                </div>
              ) : (
                <div className="grid h-full min-h-[200px] place-items-center rounded-xl border border-dashed border-slate-300 bg-surface p-6 text-center text-sm text-slate-500">
                  No certificate artwork is attached to this record, but the certificate is valid.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
