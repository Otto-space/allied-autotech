"use client";

import { useEffect, useRef } from "react";

export function Feedback({
  message,
  tone = "error",
}: {
  readonly message?: string | null;
  readonly tone?: "error" | "success" | "info";
}) {
  const ref = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    if (!message) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message]);
  if (!message) return null;
  return (
    <output
      ref={ref}
      className={`notice ${tone === "info" ? "" : tone}`}
      role={tone === "error" ? "alert" : undefined}
      tabIndex={-1}
    >
      {message}
    </output>
  );
}
