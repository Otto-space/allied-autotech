"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function GarageDialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current ??= document.activeElement;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    modal?.showModal();
    document.body.style.overflow = "hidden";
    modal?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      modal?.close();
      document.body.style.overflow = overflow;
      queueMicrotask(() => {
        if (modal?.isConnected) return;
        if (opener.current instanceof HTMLElement && opener.current.isConnected)
          opener.current.focus();
        else document.getElementById("garage-add")?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="garage-dialog"
      tabIndex={-1}
      aria-labelledby="garage-dialog-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="garage-dialog-heading">
        <h2 id="garage-dialog-title">{title}</h2>
        <button
          type="button"
          aria-label="Close vehicle dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
