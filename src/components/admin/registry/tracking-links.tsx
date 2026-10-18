"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Panel } from "@/components/admin/ui";
import { SOCIAL_SOURCES, sourceLabel, trackingUrl } from "@/lib/registry/fields";
import { CopyButton } from "./copy-button";

/** Fixed categorical order (validated palette): source identity never changes colour when the mix changes. */
const SOURCE_ORDER = ["direct", "facebook", "instagram", "linkedin", "tiktok", "whatsapp", "youtube", "x"];
const PALETTE = ["#046bd2", "#d97706", "#16a34a", "#db2777", "#0891b2", "#7c3aed", "#b45309", "#4f46e5"];
const OTHER = "#94a3b8";

export function TrackingLinks({ registrationUrl, campaign }: { registrationUrl: string; campaign: string }) {
  const rows = Object.entries(SOCIAL_SOURCES).map(([key, label]) => ({ key, label, url: trackingUrl(registrationUrl, key, campaign) }));
  if (!rows[0]?.url) return <p className="text-sm text-slate-500">Enter a valid absolute registration URL to generate tracking links.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 py-2">
          <span className="w-24 shrink-0 text-sm font-semibold text-slate-800">{r.label}</span>
          <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600" title={r.url}>{r.url}</code>
          <CopyButton value={r.url} />
        </li>
      ))}
    </ul>
  );
}

export type SourceCount = { source: string; count: number };

export function SourceAnalytics({ data }: { data: SourceCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const sorted = [...data].sort((a, b) => {
    const ia = SOURCE_ORDER.indexOf(a.source), ib = SOURCE_ORDER.indexOf(b.source);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.count - a.count;
  });
  const colour = (src: string) => { const i = SOURCE_ORDER.indexOf(src); return i === -1 ? OTHER : PALETTE[i]; };
  return (
    <Panel title="Registrations by source" description={`${total} registration${total === 1 ? "" : "s"} tracked via UTM source`}>
      {total === 0 ? (
        <p className="text-sm text-slate-500">No registrations yet. Share the tracking links above to attribute sign-ups to each channel.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="relative h-44" role="img" aria-label="Donut chart of registrations by source">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sorted} dataKey="count" nameKey="source" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {sorted.map((d) => <Cell key={d.source} fill={colour(d.source)} />)}
                </Pie>
                <Tooltip formatter={(v, _n, p) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, sourceLabel(String((p as { payload?: SourceCount }).payload?.source ?? ""))]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center"><p className="font-display text-2xl font-extrabold text-slate-900">{total}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">total</p></div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="py-1 text-left">Source</th><th className="py-1 text-right">Count</th><th className="py-1 text-right">Share</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((d) => (
                <tr key={d.source}>
                  <td className="py-1.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: colour(d.source) }} aria-hidden /> <span className="text-slate-800">{sourceLabel(d.source)}</span></td>
                  <td className="py-1.5 text-right font-semibold text-slate-900">{d.count}</td>
                  <td className="py-1.5 text-right text-slate-500">{Math.round((d.count / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
