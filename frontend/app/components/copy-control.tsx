"use client";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Values remain in memory. Never include security material in messages or logs. */
export function CopyControl({
  value,
  label,
  fieldId,
}: {
  value: string;
  label: string;
  fieldId: string;
}) {
  const [state, setState] = useState<"ready" | "copied" | "manual">("ready");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Unavailable");
      await navigator.clipboard.writeText(value);
      if (!mounted.current) return;
      setState("copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("ready"), 2500);
    } catch {
      if (!mounted.current) return;
      const field = document.getElementById(fieldId);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.focus();
        field.select();
      }
      setState("manual");
    }
  }
  return (
    <div className="copy-control">
      <button
        type="button"
        className="button secondary"
        onClick={() => void copy()}
        aria-label={label}
        title={label}
      >
        {state === "copied" ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
        {state === "copied" ? "Copied" : label}
      </button>
      <span role="status" aria-live="polite">
        {state === "manual"
          ? "Select and copy the value above using your device’s copy command."
          : state === "copied"
            ? "Copied to clipboard."
            : ""}
      </span>
    </div>
  );
}
