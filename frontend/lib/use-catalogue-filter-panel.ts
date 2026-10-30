"use client";

import { useEffect, useRef, useState } from "react";
import { containDialogFocus } from "./dialog-focus";

/** One form: inline desktop rail, modal drawer on smaller screens. */
export function useCatalogueFilterPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  const [discardVersion, setDiscardVersion] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const layout = () => {
      if (!dialog.current) return;
      restoreFocus.current = false;
      dialog.current.close();
      // An inline rail must not steal focus or scroll the page on hydration.
      dialog.current.open = media.matches;
      setDesktop(media.matches);
      setOpen(media.matches);
      setReady(true);
      setDiscardVersion((value) => value + 1);
    };
    const frame = requestAnimationFrame(layout);
    media.addEventListener("change", layout);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", layout);
    };
  }, []);

  useEffect(() => {
    if (!open || desktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, desktop]);

  function close() {
    restoreFocus.current = true;
    dialog.current?.close();
  }
  function show() {
    if (!dialog.current) return;
    restoreFocus.current = true;
    if (window.matchMedia("(min-width: 1024px)").matches) dialog.current.open = true;
    else dialog.current.showModal();
    setOpen(true);
  }
  function applied() {
    if (window.matchMedia("(max-width: 1023px)").matches) close();
  }
  return {
    dialog,
    trigger,
    open,
    desktop,
    ready,
    discardVersion,
    close,
    show,
    applied,
    onClose() {
      const shouldRestore = restoreFocus.current;
      restoreFocus.current = true;
      // A resize may have already reopened the same form as an inline rail.
      if (dialog.current?.open) return;
      setOpen(false);
      setDiscardVersion((value) => value + 1);
      if (shouldRestore) trigger.current?.focus({ preventScroll: true });
    },
    onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
      if (event.currentTarget.matches(":modal")) containDialogFocus(event);
    },
  };
}
