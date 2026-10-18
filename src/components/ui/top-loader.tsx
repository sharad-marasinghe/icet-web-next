"use client";

import * as React from "react";

/**
 * Slim progress bar pinned to the top of the viewport during client-side navigation.
 *
 * Next.js has no global router events, so:
 * - start: a click on an internal link (captured before <Link> handles it), or `startTopLoader()`
 *   for programmatic navigation such as `router.push` after a form submit;
 * - done: Next.js calls `history.pushState` when the new route commits, so we hook that;
 *   a safety timeout covers navigations that never commit (e.g. cancelled).
 * Navigations that finish within SHOW_DELAY_MS (prefetched routes) never show the bar.
 */
const START_EVENT = "icet:top-loader-start";
const DONE_EVENT = "icet:top-loader-done";
const SHOW_DELAY_MS = 100;
const SAFETY_TIMEOUT_MS = 12000;

/** Call before a programmatic navigation (router.push / router.replace). */
export function startTopLoader() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

/** Call if a programmatic navigation was abandoned. */
export function doneTopLoader() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DONE_EVENT));
}

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const anchor = (e.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download") || anchor.getAttribute("rel")?.includes("external")) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return false;
  // Same page (or only the #hash changes): no route transition happens.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Default colours: the green/cyan of the iCET logo. Brand blue would vanish against the blue
 * announcement bar at the top of the site, while green/cyan reads on both blue and white.
 */
export function TopLoader({ from = "#22c55e", to = "#22d3ee" }: { from?: string; to?: string }) {
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const active = React.useRef(false);
  const startAddress = React.useRef("");
  const timers = React.useRef<{ show?: number; trickle?: number; safety?: number; hide?: number }>({});

  React.useEffect(() => {
    const t = timers.current;
    const clearAll = () => {
      window.clearTimeout(t.show);
      window.clearInterval(t.trickle);
      window.clearTimeout(t.safety);
      window.clearTimeout(t.hide);
    };

    const done = () => {
      if (!active.current) return;
      active.current = false;
      clearAll();
      setProgress(100);
      // Let the bar reach 100%, fade out at full width, then reset it while invisible.
      t.hide = window.setTimeout(() => {
        setVisible(false);
        t.hide = window.setTimeout(() => setProgress(0), 320);
      }, 250);
    };

    const start = () => {
      if (active.current) return;
      active.current = true;
      startAddress.current = window.location.pathname + window.location.search;
      clearAll();
      setProgress(0);
      t.show = window.setTimeout(() => {
        setVisible(true);
        setProgress(12);
        // Ease towards 90% while waiting for the route to commit.
        t.trickle = window.setInterval(() => {
          setProgress((p) => (p >= 90 ? p : p + Math.max(0.6, (90 - p) * 0.08)));
        }, 200);
      }, SHOW_DELAY_MS);
      t.safety = window.setTimeout(done, SAFETY_TIMEOUT_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };

    // Next.js commits client navigations with history.pushState (router.push / <Link>) or
    // history.replaceState (router.replace). replaceState is also used for housekeeping such as
    // scroll restoration, so it only counts when the address actually changed.
    const currentAddress = () => window.location.pathname + window.location.search;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function patchedPushState(this: History, ...args: Parameters<History["pushState"]>) {
      const result = originalPushState.apply(this, args);
      done();
      return result;
    };
    window.history.replaceState = function patchedReplaceState(this: History, ...args: Parameters<History["replaceState"]>) {
      const result = originalReplaceState.apply(this, args);
      if (active.current && currentAddress() !== startAddress.current) done();
      return result;
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    window.addEventListener(DONE_EVENT, done);
    window.addEventListener("popstate", done);
    window.addEventListener("pageshow", done);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      window.removeEventListener(DONE_EVENT, done);
      window.removeEventListener("popstate", done);
      window.removeEventListener("pageshow", done);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearAll();
    };
  }, []);

  return (
    <div
      aria-hidden
      data-top-loader=""
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] print:hidden"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="relative h-full"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          transition: progress === 0 ? "none" : "width 200ms ease-out",
          boxShadow: `0 0 10px ${to}, 0 0 4px ${to}`,
        }}
      >
        {/* Glowing tip, as in the reference design */}
        <span
          className="absolute right-0 top-0 h-full w-24"
          style={{ boxShadow: `0 0 12px 2px ${to}`, opacity: 0.9, transform: "rotate(2deg) translate(0, -2px)" }}
        />
      </div>
    </div>
  );
}
