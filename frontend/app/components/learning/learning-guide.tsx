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
  const definition = resource.data?.flags.guides
    ? resource.data.guides.find((g) => g.id === id)
    : undefined;
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
          <button className="button secondary" onClick={resource.refresh}>
            Retry guide
          </button>
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
  // Learning interaction evidence only. No form values or record identifiers.
  const completedInteractions = useRef(new Set<string>());
  const [waiting, setWaiting] = useState(false);
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
    function completed(event: Event) {
      const source = event.target;
      if (
        !(source instanceof HTMLElement) ||
        !source.closest(`[data-learning-target="${current.target}"]`)
      )
        return;
      if (
        current.event === "input" &&
        (!(
          source instanceof HTMLInputElement ||
          source instanceof HTMLTextAreaElement ||
          source instanceof HTMLSelectElement
        ) ||
          source.value.trim().length < 2)
      )
        return;
      if (
        current.event === "read" ||
        event.type !== (current.event === "input" ? "input" : "click")
      )
        return;
      completedInteractions.current.add(current.id);
      setReady(true);
    }
    function attach() {
      if (disposed) return;
      if (narrow.matches) {
        setWritten(true);
        return;
      }
      const found = document.querySelector<HTMLElement>(
        `[data-learning-target="${current.target}"]`,
      );
      if (!found?.getClientRects().length || found.closest("[hidden], [inert]")) {
        if (target) {
          dispose();
          target = null;
          setMissing(true);
        }
        return;
      }
      const busy = !!found.closest('[aria-busy="true"]');
      setWaiting(busy);
      if (target === found) {
        if (current.event === "read") setReady(!busy);
        return;
      }
      dispose();
      target = found;
      target.classList.add("learning-highlight");
      setMissing(false);
      // A server-rendered same-page search may replace the input between input
      // and hydration. Reconcile its current user-entered state without storing it.
      if (
        current.event === "input" &&
        (found instanceof HTMLInputElement ||
          found instanceof HTMLTextAreaElement ||
          found instanceof HTMLSelectElement) &&
        found.value.trim().length >= 2
      )
        completedInteractions.current.add(current.id);
      setReady(
        current.event === "read" ? !busy : completedInteractions.current.has(current.id),
      );
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
      updatePosition();
      const resize = new ResizeObserver(updatePosition);
      if (panel.current) resize.observe(panel.current);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, { passive: true });
      dispose = () => {
        resize.disconnect();
        found.classList.remove("learning-highlight");
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition);
      };
    }
    const frame = requestAnimationFrame(() => {
      setReady(completedInteractions.current.has(current.id));
      setMissing(false);
      attach();
    });
    const observer = new MutationObserver(attach);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-busy", "hidden", "inert"],
    });
    document.addEventListener("input", completed, true);
    document.addEventListener("click", completed, true);
    const timeout = setTimeout(() => {
      if (!target && !narrow.matches) setMissing(true);
    }, 5000);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      observer.disconnect();
      document.removeEventListener("input", completed, true);
      document.removeEventListener("click", completed, true);
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
      data-reading-focus
      className="learning-guide-panel"
      data-side={side}
      data-edge={edge}
      aria-label="Optional guide"
    >
      <p className="learning-eyebrow">
        Optional guide · {step + 1} of {guide.steps.length}
      </p>
      <h2>{guide.title}</h2>
      <progress
        className="learning-guide-progress"
        aria-label="Guide progress"
        max={guide.steps.length}
        value={status === "completed" ? guide.steps.length : step}
      />
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
          {!written && !missing && !ready && (
            <p id="learning-step-condition" className="learning-condition" role="status">
              {waiting
                ? "Wait for the results to finish loading, then review them."
                : current.event === "input"
                  ? "Enter at least two characters in the highlighted field to continue."
                  : current.event === "click"
                    ? "Open the highlighted control yourself to continue."
                    : "Wait for this step’s control to become available."}
            </p>
          )}
        </>
      )}
      <div className="learning-actions">
        {status === "active" && page === guide.page && !missing && (
          <button
            className="button"
            disabled={!written && !ready}
            aria-describedby={!written && !ready ? "learning-step-condition" : undefined}
            onClick={next}
          >
            {written ? "Mark step read" : "Next step"}
          </button>
        )}
        {status === "active" && !written && !missing && page === guide.page && (
          <button
            className="button secondary"
            onClick={() => {
              document
                .querySelector<HTMLElement>(`[data-learning-target="${current.target}"]`)
                ?.scrollIntoView({ block: "center", behavior: "instant" });
            }}
          >
            Show page control
          </button>
        )}
        {status === "active" && step > 0 && (
          <button
            className="button secondary"
            onClick={() => {
              setStep(step - 1);
              persist("active", step - 1);
            }}
          >
            Back
          </button>
        )}
        <button
          className="learning-text-button"
          onClick={() => {
            persist("dismissed");
            onClose();
          }}
        >
          Exit guide
        </button>
      </div>
      <details className="learning-guide-options">
        <summary>Guide options</summary>
        <div className="learning-actions">
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
              completedInteractions.current.clear();
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
        </div>
      </details>
      {page !== guide.page && (
        <Link href={`${guide.href}#learn=${guide.id}`}>
          Open the guide page when ready
        </Link>
      )}
      {written && (
        <details className="learning-written-reference">
          <summary>Read all written steps</summary>
          <WrittenGuide guide={guide} />
        </details>
      )}
    </aside>
  );
}
