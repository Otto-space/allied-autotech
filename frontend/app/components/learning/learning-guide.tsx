"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { learningPage, type LearningGuide } from "@/lib/learning/contracts";
import { useLearningCatalogue } from "@/lib/learning/read";
import { loadLearningProgress, saveLearningProgress } from "@/lib/learning/progress";
import { WrittenGuide } from "./learning-panel";

export function LearningGuideRunner({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const resource = useLearningCatalogue(),
    path = usePathname();
  const definition = resource.data?.guides.find((g) => g.id === id);
  return (
    <>
      {resource.loading && (
        <aside className="learning-guide-panel" aria-label="Optional guide">
          <p role="status">Rechecking guide access…</p>
          <button onClick={onClose}>Exit guide</button>
        </aside>
      )}
      {resource.error && (
        <aside className="learning-guide-panel">
          <p role="alert">{resource.error}</p>
          <button onClick={onClose}>Exit guide</button>
        </aside>
      )}
      {resource.data && (
        <div hidden={resource.loading} inert={resource.loading}>
          {definition ? (
            <Guide
              key={
                resource.data.accessKey + ":" + definition.id + ":" + definition.version
              }
              guide={definition}
              accessKey={resource.data.accessKey}
              page={learningPage(path)}
              checking={resource.loading}
              onClose={onClose}
            />
          ) : (
            <aside className="learning-guide-panel">
              <p>This guide is unavailable under your current access.</p>
              <Link href="/learn">Available learning</Link>
              <button onClick={onClose}>Exit guide</button>
            </aside>
          )}
        </div>
      )}
    </>
  );
}
function Guide({
  guide,
  accessKey,
  page,
  checking,
  onClose,
}: {
  guide: LearningGuide;
  accessKey: string;
  page: string;
  checking: boolean;
  onClose: () => void;
}) {
  const [saved] = useState(() =>
    loadLearningProgress(accessKey, guide.id, guide.version),
  );
  const [step, setStep] = useState(() =>
    saved && saved !== "restart" ? Math.min(saved.step, guide.steps.length - 1) : 0,
  );
  const [status, setStatus] = useState<"active" | "paused" | "completed">(() =>
    saved && saved !== "restart" && saved.status === "completed"
      ? "completed"
      : saved && saved !== "restart" && saved.status === "paused"
        ? "paused"
        : "active",
  );
  const [ready, setReady] = useState(false),
    [missing, setMissing] = useState(false),
    [written, setWritten] = useState(false),
    [side, setSide] = useState("right"),
    [edge, setEdge] = useState("bottom"),
    [storage, setStorage] = useState(true);
  const panel = useRef<HTMLElement>(null),
    current = guide.steps[step];
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (checking || status !== "active" || written || page !== guide.page) return;
    let target: HTMLElement | null = null,
      dispose = () => {},
      disposed = false;
    const narrow = matchMedia("(max-width: 767px)");
    function attach() {
      if (disposed) return;
      if (narrow.matches) {
        setWritten(true);
        return;
      }
      const found = document.querySelector<HTMLElement>(
        `[data-learning-target="${current.target}"]`,
      );
      if (!found?.getClientRects().length || found.closest("[hidden], [inert]")) return;
      target = found;
      target.classList.add("learning-highlight");
      setMissing(false);
      setReady(current.event === "read");
      function updatePosition() {
        const bounds = found!.getBoundingClientRect(),
          box = panel.current?.getBoundingClientRect();
        if (!box) return;
        const preferred =
          bounds.left + bounds.width / 2 > innerWidth / 2
            ? ["left", "right"]
            : ["right", "left"];
        const positions = preferred.flatMap((horizontal) =>
          ["bottom", "top"].map((vertical) => ({
            horizontal,
            vertical,
            left: horizontal === "left" ? 18 : innerWidth - box.width - 18,
            top: vertical === "top" ? 90 : innerHeight - box.height - 18,
          })),
        );
        const available = positions.find(
          (p) =>
            p.left + box.width + 12 < bounds.left ||
            p.left - 12 > bounds.right ||
            p.top + box.height + 12 < bounds.top ||
            p.top - 12 > bounds.bottom,
        );
        if (available) {
          setSide(available.horizontal);
          setEdge(available.vertical);
          setMissing(false);
          found!.classList.add("learning-highlight");
        } else {
          setMissing(true);
          found!.classList.remove("learning-highlight");
        }
      }
      function completed(event: Event) {
        if (current.event === "input") {
          const control = event.target;
          if (
            !(
              control instanceof HTMLInputElement ||
              control instanceof HTMLTextAreaElement ||
              control instanceof HTMLSelectElement
            ) ||
            control.value.trim().length < 2
          )
            return;
        }
        setReady(true);
      }
      const event = current.event === "input" ? "input" : "click";
      if (current.event !== "read") found.addEventListener(event, completed);
      updatePosition();
      const resize = new ResizeObserver(updatePosition);
      if (panel.current) resize.observe(panel.current);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, { passive: true });
      dispose = () => {
        resize.disconnect();
        found.classList.remove("learning-highlight");
        found.removeEventListener(event, completed);
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition);
      };
    }
    const frame = requestAnimationFrame(() => {
      setReady(false);
      setMissing(false);
      attach();
    });
    const observer = new MutationObserver(() => {
      if (!target) attach();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(() => {
      if (!target && !narrow.matches) setMissing(true);
      observer.disconnect();
    }, 5000);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      observer.disconnect();
      dispose();
    };
  }, [checking, current, guide.page, page, status, written]);
  function persist(
    nextStatus: "active" | "paused" | "completed" | "dismissed",
    nextStep = step,
  ) {
    setStorage(
      saveLearningProgress(accessKey, {
        id: guide.id,
        version: guide.version,
        step: nextStep,
        status: nextStatus,
        lastActivity: Date.now(),
      }),
    );
  }
  function next() {
    if (!written && (!ready || missing)) return;
    if (step + 1 === guide.steps.length) {
      setStatus("completed");
      persist("completed");
    } else {
      setReady(false);
      setStep(step + 1);
      persist("active", step + 1);
    }
  }
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      className="learning-guide-panel"
      data-side={side}
      data-edge={edge}
      aria-label="Optional guide"
    >
      <p className="learning-eyebrow">
        Optional guide · {step + 1} of {guide.steps.length}
      </p>
      <h2>{guide.title}</h2>
      {saved === "restart" && (
        <p role="status">
          This definition changed. Start again with these reviewed steps.
        </p>
      )}
      {!storage && (
        <p role="status">
          Progress could not be stored; the guide still works in this tab.
        </p>
      )}
      {status === "completed" ? (
        <p role="status">
          Guide complete. No request, payment or operational action was submitted by this
          guide.
        </p>
      ) : status === "paused" || page !== guide.page ? (
        <p role="status">Guide paused. Your form values and filters were not changed.</p>
      ) : (
        <>
          <p aria-live="polite" aria-atomic="true">
            {current.text}
          </p>
          {missing && (
            <p role="status">
              This control is unavailable or cannot be highlighted without covering it.
              Use the written steps; no other control will be highlighted.
            </p>
          )}
          {written && (
            <p className="learning-scope">
              Written mode. Mark steps as read; this does not certify a live action.
            </p>
          )}
        </>
      )}
      <div className="learning-actions">
        {status === "active" && page === guide.page && !missing && (
          <button className="button" disabled={!written && !ready} onClick={next}>
            {written ? "Mark step read" : "Next step"}
          </button>
        )}
        {status !== "completed" && page === guide.page && (
          <button
            className="button secondary"
            onClick={() => {
              const nextStatus = status === "active" ? "paused" : "active";
              setStatus(nextStatus);
              persist(nextStatus);
            }}
          >
            {status === "active" ? "Pause guide" : "Resume guide"}
          </button>
        )}
        <button
          className="button secondary"
          onClick={() => {
            setStep(0);
            setStatus("active");
            setReady(false);
            persist("active", 0);
          }}
        >
          Restart guide
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setWritten((v) => !v);
            setMissing(false);
          }}
        >
          {written ? "Try page controls" : "Use written steps"}
        </button>
        <button
          className="button secondary"
          onClick={() => {
            persist("dismissed");
            onClose();
          }}
        >
          Exit guide
        </button>
      </div>
      {page !== guide.page && (
        <Link href={`${guide.href}#learn=${guide.id}`}>
          Open the guide page when ready
        </Link>
      )}
      {written && <WrittenGuide guide={guide} />}
    </aside>
  );
}
