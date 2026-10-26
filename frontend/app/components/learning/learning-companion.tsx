"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { containDialogFocus } from "@/lib/dialog-focus";
import { learningEnabled } from "@/lib/learning/contracts";
import { clearLearningProgress } from "@/lib/learning/progress";
import { LEARNING_SESSION_CHANGED } from "@/lib/learning/read";
import { OPEN_LEARNING, START_LEARNING_GUIDE } from "./learning-entry";
const Panel = lazy(() =>
  import("./learning-panel").then((m) => ({ default: m.LearningPanel })),
);
const Runner = lazy(() =>
  import("./learning-guide").then((m) => ({ default: m.LearningGuideRunner })),
);

export function LearningCompanion() {
  const path = usePathname(),
    dialog = useRef<HTMLDialogElement>(null),
    launcher = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false),
    [guide, setGuide] = useState<string | null>(null);
  function close() {
    dialog.current?.close();
    setOpen(false);
    if (launcher.current?.isConnected) launcher.current.focus();
  }
  useEffect(() => {
    if (!learningEnabled()) return;
    function show() {
      launcher.current = document.activeElement as HTMLElement;
      setOpen(true);
    }
    function start(event: Event) {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(id)) {
        dialog.current?.close();
        setOpen(false);
        setGuide(id);
      }
    }
    function hash() {
      const match = /^#learn=([a-z][a-z0-9-]{0,63})$/.exec(location.hash);
      if (match) setGuide(match[1]);
    }
    function invalidate() {
      clearLearningProgress();
      dialog.current?.close();
      setOpen(false);
      setGuide(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGuide(null);
      }
    }
    hash();
    window.addEventListener(OPEN_LEARNING, show);
    window.addEventListener(START_LEARNING_GUIDE, start);
    window.addEventListener("hashchange", hash);
    window.addEventListener(LEARNING_SESSION_CHANGED, invalidate);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener(OPEN_LEARNING, show);
      window.removeEventListener(START_LEARNING_GUIDE, start);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener(LEARNING_SESSION_CHANGED, invalidate);
      window.removeEventListener("keydown", escape);
    };
  }, [path]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  if (!learningEnabled()) return null;
  return (
    <>
      <dialog
        className="learning-dialog"
        ref={dialog}
        aria-labelledby="learning-dialog-title"
        onKeyDown={containDialogFocus}
        onClose={close}
      >
        <header className="learning-dialog-head">
          <h2 id="learning-dialog-title">Help & Learn</h2>
          <button className="button secondary" onClick={close}>
            Close help
          </button>
        </header>
        {open && (
          <Suspense fallback={<p role="status">Loading help…</p>}>
            <Panel onNavigate={close} />
          </Suspense>
        )}
      </dialog>
      {guide && (
        <Suspense fallback={<p role="status">Loading optional guide…</p>}>
          <Runner
            id={guide}
            onClose={() => {
              setGuide(null);
              if (location.hash.startsWith("#learn="))
                history.replaceState(null, "", location.pathname + location.search);
              if (launcher.current?.isConnected) launcher.current.focus();
            }}
          />
        </Suspense>
      )}
    </>
  );
}
