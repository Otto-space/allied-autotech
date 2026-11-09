"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keep return focus owned by the workspace, including when a filtered row leaves. */
export function useAccountActionRefresh({
  refresh,
  refreshing,
  settledRevision,
}: {
  refresh: () => void;
  refreshing: boolean;
  settledRevision: number | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const changedAt = useRef<number | null | undefined>(undefined);
  const [target, setTarget] = useState<HTMLElement | null>();
  const onReviewClosed = useCallback((opener: HTMLElement | null) => {
    if (changedAt.current !== undefined) setTarget(opener);
  }, []);

  useEffect(() => {
    if (target === undefined || refreshing || settledRevision === changedAt.current)
      return;
    const frame = requestAnimationFrame(() => {
      setTarget(undefined);
      changedAt.current = undefined;
      const focused = document.activeElement;
      if (
        document.querySelector("dialog:modal") ||
        (focused &&
          focused !== document.body &&
          focused !== document.documentElement &&
          focused !== target)
      )
        return;
      const available =
        target?.isConnected &&
        !target.matches(":disabled, [aria-disabled='true']") &&
        target.getClientRects().length > 0;
      (available ? target : heading.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshing, settledRevision, target]);

  return {
    headingRef: heading,
    onChanged() {
      changedAt.current = settledRevision;
      refresh();
    },
    onReviewClosed,
  };
}
