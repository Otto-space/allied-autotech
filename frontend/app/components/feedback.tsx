"use client";

import { useEffect, useRef } from "react";

export function Feedback({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "error" | "success" | "info";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={ref}
      className={`notice ${tone === "info" ? "" : tone}`}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
    >
      {message}
    </div>
  );
}
