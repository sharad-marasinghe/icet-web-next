"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** Current year rendered on the client so prerendered shells stay stable. */
export function Year() {
  const year = useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => 2026);
  return <>{year}</>;
}
