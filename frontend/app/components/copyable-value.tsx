"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import styles from "./copyable-value.module.css";

/** Copies only the supplied permitted value; never reads or logs the clipboard. */
export function CopyableValue({
  value,
  label,
  display,
}: {
  value?: string | null;
  label: string;
  display?: string;
}) {
  const id = useId(),
    text = useRef<HTMLSpanElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    active = useRef(true);
  const [state, setState] = useState<"ready" | "copied" | "manual">("ready");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  if (!value) return <span>Not provided</span>;
  async function copy() {
    clearTimeout(timer.current);
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText)
        throw new Error("Unavailable");
      await navigator.clipboard.writeText(value!);
      if (!active.current) return;
      setState("copied");
      timer.current = setTimeout(() => setState("ready"), 2500);
    } catch {
      if (!active.current) return;
      setState("manual");
      if (text.current) {
        const range = document.createRange();
        range.selectNodeContents(text.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }
  return (
    <span className={styles.value} data-copy-state={state}>
      <span ref={text} className={styles.text} title={value}>
        {state === "manual" ? value : (display ?? value)}
      </span>
      <button
        type="button"
        className={styles.copy}
        aria-label={label}
        title={label}
        aria-describedby={id}
        onClick={() => void copy()}
      >
        {state === "copied" ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
      </button>
      <span
        id={id}
        role="status"
        className={state === "ready" ? "sr-only" : styles.feedback}
      >
        {state === "copied"
          ? "Copied"
          : state === "manual"
            ? "Copy unavailable. Select the value and use your device’s copy command."
            : ""}
      </span>
    </span>
  );
}
