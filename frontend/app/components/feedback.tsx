"use client";
import { useEffect } from "react";
import { notify, type NoticeTone } from "@/lib/notifications";
import { useScrollToMessage } from "@/lib/use-scroll-to-message";

export function Feedback({
  message,
  tone = "error",
  toast,
}: {
  message?: string | null;
  tone?: NoticeTone;
  toast?: string;
}) {
  const ref = useScrollToMessage(message);
  useEffect(() => {
    if (message && toast) notify(toast, { tone, inlineAnnounced: true });
  }, [message, toast, tone]);
  if (!message) return null;
  return (
    <div
      className={`notice ${tone === "info" ? "" : tone}`}
      ref={ref}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
