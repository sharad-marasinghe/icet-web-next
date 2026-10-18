"use client";
import * as React from "react";

/** Fetches the anti-bot token lazily so cached pages always submit with a fresh one. */
export function useFormToken() {
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setToken(d.token))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const refresh = React.useCallback(async () => {
    const r = await fetch("/api/form-token", { cache: "no-store" });
    const d = await r.json();
    setToken(d.token);
    return d.token as string;
  }, []);
  return { token, refresh };
}

export function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(window.location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = sp.get(k);
    if (v) out[k] = v;
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem("icet-utm") || "{}");
    const merged = { ...stored, ...out };
    sessionStorage.setItem("icet-utm", JSON.stringify(merged));
    return merged;
  } catch {
    return out;
  }
}
