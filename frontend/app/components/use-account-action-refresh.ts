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
  const [target, setTarget] = useState<{
    opener: HTMLElement | null;
    fallback?: HTMLElement | null;
  }>();
  const onReviewClosed = useCallback(
    (opener: HTMLElement | null, fallback?: HTMLElement | null) => {
      // An unknown outcome can disable the opener without refreshing history.
      if (changedAt.current !== undefined || fallback) setTarget({ opener, fallback });
    },
    [],
  );

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
          focused !== target.opener)
      )
        return;
      const available =
        target.opener?.isConnected &&
        !target.opener.matches(":disabled, [aria-disabled='true']") &&
        target.opener.getClientRects().length > 0;
      const fallback = target.fallback?.isConnected ? target.fallback : heading.current;
      (available ? target.opener : fallback)?.focus();
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
