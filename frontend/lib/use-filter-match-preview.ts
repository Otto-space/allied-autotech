"use client";

import { useEffect, useState } from "react";
import { useResource } from "./api/use-resource";

function parseCount(value: unknown) {
  const count = (value as { totalMatches?: unknown } | null)?.totalMatches;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
    throw new Error("Invalid catalogue count");
  return count;
}

/** Preview one bounded discovery response after a pause; never navigate. */
export function useFilterMatchPreview(path: string | null) {
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(path), 600);
    return () => clearTimeout(timer);
  }, [path]);
  const current = path && settled === path ? path : null;
  const resource = useResource(current, parseCount);
  return {
    count: current ? resource.data : undefined,
    pending: !!path && (settled !== path || resource.loading),
    error: current ? resource.error : undefined,
  };
}
