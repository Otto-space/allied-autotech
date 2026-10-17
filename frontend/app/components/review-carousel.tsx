"use client";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PublicReview } from "@/lib/api/review-schemas";
import { ReviewCard } from "./review-card";

const subscribeMotion = (changed: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};
const subscribeVisibility = (changed: () => void) => {
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
};
const serverSnapshot = () => false;
const motionSnapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const visibilitySnapshot = () => document.visibilityState === "visible";

export function ReviewCarousel({
  items,
  refreshing = false,
  refreshControl,
}: {
  items: PublicReview[];
  refreshing?: boolean;
  refreshControl?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    visibilitySnapshot,
    serverSnapshot,
  );
  const index = Math.max(
    0,
    items.findIndex((review) => review.id === selectedId),
  );
  const advancing =
    items.length > 1 &&
    playing &&
    !hovered &&
    !focused &&
    !reduced &&
    visible &&
    onScreen &&
    !refreshing;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(
      () => setSelectedId(items[(index + 1) % items.length].id),
      8000,
    );
    return () => window.clearTimeout(timer);
  }, [advancing, index, items]);

  function select(next: number) {
    setPlaying(false);
    setSelectedId(items[(next + items.length) % items.length].id);
  }

  return (
    <div
      ref={container}
      className="home-reviews-carousel"
      data-multiple={items.length > 1}
      role="region"
      aria-roledescription="carousel"
      aria-label="Published customer feedback"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        setFocused(true);
        if (!(event.target as HTMLElement).closest(".home-reviews-rotation"))
          setPlaying(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (
          items.length > 1 &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          select(index + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          touch.current = { x: event.clientX, y: event.clientY };
          setPlaying(false);
        }
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
      onPointerUp={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start || items.length < 2) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y))
          select(index + (dx < 0 ? 1 : -1));
      }}
    >
      {items.length > 1 && !reduced && (
        <button
          type="button"
          className="home-reviews-rotation"
          aria-label={playing ? "Pause reviews" : "Play reviews"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          {playing ? "Pause reviews" : "Play reviews"}
        </button>
      )}
      <div
        id="home-review-slides"
        className="home-reviews-track"
        aria-live={advancing ? "off" : "polite"}
        aria-atomic="true"
      >
        {items.map((review, position) => (
          <div
            key={review.id}
            className="home-reviews-slide"
            data-active={position === index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${items.length}`}
            aria-hidden={position !== index}
            inert={position !== index}
          >
            <ReviewCard review={review} variant="testimonial" />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="home-reviews-navigation">
          <button
            type="button"
            aria-label="Previous review"
            aria-controls="home-review-slides"
            onClick={() => select(index - 1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="home-reviews-count" aria-live="off">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            aria-label="Next review"
            aria-controls="home-review-slides"
            onClick={() => select(index + 1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="home-reviews-refresh">{refreshControl}</div>
    </div>
  );
}
