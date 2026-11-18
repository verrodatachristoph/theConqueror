"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. `serverDefault` is what the server (and the
 * first hydration pass) assumes; the real value follows right after.
 */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}
