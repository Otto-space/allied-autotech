"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { containDialogFocus } from "@/lib/dialog-focus";
import { learningEnabled } from "@/lib/learning/contracts";
import { clearLearningProgress } from "@/lib/learning/progress";
import { LEARNING_SESSION_CHANGED } from "@/lib/learning/read";
import {
  consumeLearningOpen,
  OPEN_LEARNING,
  START_LEARNING_GUIDE,
} from "./learning-entry";
import {
  assistantName,
  ASSISTANT_HIDDEN_KEY,
  ASSISTANT_VISIBILITY,
} from "@/lib/learning/search";
import { AllieAvatar } from "./allie-avatar";
import { X } from "lucide-react";
const Panel = lazy(() =>
  import("./allie-panel").then((m) => ({ default: m.AlliePanel })),
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
  const restoreFocus = useRef(true);
  const openedOn = useRef(path);
  const hashGuide = useRef<string | null>(null);
  function close(restore = true) {
    restoreFocus.current = restore;
    dialog.current?.close();
    setOpen(false);
  }
  function closed() {
    setOpen(false);
    if (
      restoreFocus.current &&
      openedOn.current === location.pathname &&
      launcher.current?.isConnected
    )
      launcher.current.focus({ preventScroll: true });
    restoreFocus.current = true;
  }
  useEffect(() => {
    if (!learningEnabled()) return;
    function show() {
      consumeLearningOpen();
      launcher.current = document.activeElement as HTMLElement;
      openedOn.current = location.pathname;
      restoreFocus.current = true;
      try {
        sessionStorage.removeItem(ASSISTANT_HIDDEN_KEY);
      } catch {
        /* Assistance remains available without storage. */
      }
      window.dispatchEvent(new Event(ASSISTANT_VISIBILITY));
      setOpen(true);
    }
    function start(event: Event) {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(id)) {
        close(false);
        hashGuide.current = null;
        setGuide(id);
      }
    }
    function hash() {
      const match = /^#learn=([a-z][a-z0-9-]{0,63})$/.exec(location.hash);
      if (match) {
        hashGuide.current = location.pathname;
        setGuide(match[1]);
      } else if (hashGuide.current === location.pathname) {
        hashGuide.current = null;
        setGuide(null);
      }
    }
    function invalidate() {
      clearLearningProgress();
      close(false);
      setGuide(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (dialog.current?.open) return;
        setGuide(null);
        if (location.hash.startsWith("#learn="))
          history.replaceState(null, "", location.pathname + location.search);
      }
    }
    hash();
    window.addEventListener(OPEN_LEARNING, show);
    // A launcher may hydrate before this listener; honour its first activation.
    if (consumeLearningOpen()) show();
    window.addEventListener(START_LEARNING_GUIDE, start);
    window.addEventListener("hashchange", hash);
    window.addEventListener("popstate", hash);
    window.addEventListener(LEARNING_SESSION_CHANGED, invalidate);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener(OPEN_LEARNING, show);
      window.removeEventListener(START_LEARNING_GUIDE, start);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("popstate", hash);
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
        className="learning-dialog allie-dialog"
        ref={dialog}
        aria-labelledby="learning-dialog-title"
        onKeyDown={containDialogFocus}
        onClose={closed}
      >
        <header className="learning-dialog-head">
          <AllieAvatar state={open ? "helpful" : "idle"} />
          <div>
            <h2 id="learning-dialog-title">{assistantName}</h2>
            <p>Your website guide</p>
          </div>
          <button
            className="learning-close"
            aria-label="Close help"
            onClick={() => close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="allie-dialog-body">
          {open && (
            <Suspense fallback={<p role="status">Loading help…</p>}>
              <Panel onNavigate={() => close(false)} />
            </Suspense>
          )}
          <button
            className="allie-hide learning-text-button"
            onClick={() => {
              try {
                sessionStorage.setItem(ASSISTANT_HIDDEN_KEY, "true");
              } catch {}
              window.dispatchEvent(new Event(ASSISTANT_VISIBILITY));
              close();
            }}
          >
            Hide floating help for this session
          </button>
        </div>
      </dialog>
      {guide && (
        <Suspense fallback={<p role="status">Loading optional guide…</p>}>
          <Runner
            id={guide}
            onClose={() => {
              setGuide(null);
              if (location.hash.startsWith("#learn="))
                history.replaceState(null, "", location.pathname + location.search);
              requestAnimationFrame(() => {
                if (
                  openedOn.current === location.pathname &&
                  launcher.current?.isConnected
                )
                  launcher.current.focus({ preventScroll: true });
              });
            }}
          />
        </Suspense>
      )}
    </>
  );
}
