"use client";

import { useCallback, useMemo, useState } from "react";
import type { Trip } from "@/types/database.types";
import { applySelection } from "@/lib/trips";

/**
 * Person-filter state shared by home, diary and statistics.
 *
 * An empty selection means "everyone", and every chip is drawn as chosen — that is
 * the honest picture of an unfiltered page. Tapping a person out of that state
 * narrows to just them instead of removing them from a selection never made.
 */
export function usePersonFilter<T extends Trip>(trips: T[], personCodes: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [together, setTogether] = useState(false);

  const toggle = useCallback((code: string) => {
    setSelected((prev) => {
      if (prev.size === 0) return new Set([code]);
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSelected(new Set());
    setTogether(false);
  }, []);

  const filtered = useMemo(
    () => applySelection(trips, selected, together, personCodes),
    [trips, selected, together, personCodes],
  );

  // With exactly one person chosen, "together" means nothing.
  const togetherAvailable = selected.size !== 1;

  return {
    selected,
    together: together && togetherAvailable,
    togetherAvailable,
    toggle,
    reset,
    toggleTogether: () => setTogether((v) => !v),
    filtered,
  };
}

export type PersonFilterState = ReturnType<typeof usePersonFilter>;
