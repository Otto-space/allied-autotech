"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import {
  HERO_IMAGE_TIMEOUT_MS,
  HERO_INTERVAL_MS,
  heroReducer,
  initialHeroState,
} from "@/lib/hero-carousel";
import styles from "./home-hero.module.css";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const slides = [
  {
    image: "diagnostics-at-work",
    alt: "Allied technician inspecting a vehicle with its bonnet open",
    title: "Comprehensive diagnostics. Clear next steps.",
    copy: "A full vehicle health check, a PDF scan result and a conversation about what comes next.",
    action: "Explore diagnostics",
    href: "/services?search=diagnostics",
    position: "62% 50%",
  },
  {
    image: "alignment-at-work",
    alt: "Allied technician beside the workshop’s 3D wheel alignment equipment",
    title: "Wheel care. A considered approach.",
    copy: "Explore four-wheel alignment and discuss the tyre care your vehicle needs.",
    action: "Explore wheel care",
    href: "/services?search=alignment",
    position: "62% 50%",
  },
  {
    image: "tyre-care-at-work",
    alt: "A team member working beside tyre-changing equipment in the Allied workshop",
    title: "Careful work. People you can meet.",
    copy: "See the people, tools and working approach behind your vehicle care.",
    action: "Meet the team",
    href: "/about#team",
    position: "50% 50%",
  },
] as const;

export function HomeHero() {
  const [state, dispatch] = useReducer(heroReducer, initialHeroState);
  const enhanced = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pointerStop = useRef<boolean | null>(null);
  const current = slides[state.current];
  const rotating = enhanced && !stopped && !hovered && visible && inView;
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReduced(motion.matches);
      if (motion.matches) {
        setStopped(true);
        dispatch({ type: "cancel-auto" });
      }
    };
    const updateVisibility = () => {
      const showing = document.visibilityState !== "hidden";
      setVisible(showing);
      if (!showing) dispatch({ type: "cancel-auto" });
    };
    updateMotion();
    updateVisibility();
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (!entry.isIntersecting) dispatch({ type: "cancel-auto" });
      },
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  // One rotation timer; every navigation/pause starts a fresh reading interval.
  useEffect(() => {
    if (!rotating || state.pending || state.failed.every(Boolean)) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "go", direction: 1, manual: false }),
      HERO_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [rotating, state.revision, state.pending, state.failed]);
  // Bounded image wait: retain the current copy/photo until the next is decoded.
  useEffect(() => {
    if (!state.pending) return;
    const index = state.pending.index;
    const timeout = window.setTimeout(
      () => dispatch({ type: "failed", index }),
      HERO_IMAGE_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [state.pending]);
  function move(direction: number, index?: number) {
    dispatch({ type: "go", direction, index, manual: true });
  }
  return (
    <section
      ref={root}
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="Workshop highlights"
      data-slide={state.current + 1}
      data-rotating={rotating}
      data-waiting={!!state.pending}
      data-reduced-motion={reduced}
      onMouseEnter={() => {
        setHovered(true);
        dispatch({ type: "cancel-auto" });
      }}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => {
        setStopped(true);
        dispatch({ type: "cancel-auto" });
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onTouchStart={(event) => {
        const t = event.touches[0];
        touch.current =
          event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const end = event.changedTouches[0];
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
    >
      <div className={styles.layout}>
        <div className={styles.media}>
          {slides.map(
            (slide, index) =>
              (index === 0 || enhanced) && (
                <Image
                  key={slide.image}
                  src={`/images/workshop/owner/${slide.image}.webp`}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 760px) 100vw, 58vw"
                  preload={index === 0}
                  loading={index === 0 ? undefined : "eager"}
                  className={styles.photo}
                  aria-hidden={index !== state.current}
                  data-current={index === state.current && !state.failed[index]}
                  style={{ objectPosition: slide.position }}
                  onLoad={async (event) => {
                    const img = event.currentTarget;
                    try {
                      await img.decode();
                      dispatch({ type: "ready", index });
                    } catch {
                      dispatch({ type: "failed", index });
                    }
                  }}
                  onError={() => dispatch({ type: "failed", index })}
                />
              ),
          )}
          {state.failed[state.current] && (
            <span className={styles.unavailable}>Workshop photograph unavailable</span>
          )}
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>Allied AutoTech · Port Harcourt</p>
          <div className={styles.controls}>
            {enhanced && (
              <>
                <button
                  type="button"
                  onPointerDown={() => {
                    pointerStop.current = !stopped;
                  }}
                  onPointerCancel={() => {
                    pointerStop.current = null;
                  }}
                  onClick={() => {
                    const shouldStop = pointerStop.current ?? !stopped;
                    setStopped(shouldStop);
                    if (shouldStop) dispatch({ type: "cancel-auto" });
                    pointerStop.current = null;
                  }}
                  aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
                >
                  {stopped ? (
                    <Play size={17} aria-hidden="true" />
                  ) : (
                    <Pause size={17} aria-hidden="true" />
                  )}
                  <span>{stopped ? "Play" : "Pause"}</span>
                </button>
                <div className={styles.pickers} role="group" aria-label="Choose a slide">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.image}
                      type="button"
                      aria-label={`Show slide ${index + 1}: ${slide.action}`}
                      aria-current={state.current === index ? "true" : undefined}
                      onClick={() => move(index < state.current ? -1 : 1, index)}
                    >
                      <span />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next slide" onClick={() => move(1)}>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${state.current + 1} of ${slides.length}`}
          >
            <h1 id="home-title">{current.title}</h1>
            <p className={styles.copy}>{current.copy}</p>
            <Link className="button" href={current.href}>
              {current.action} <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {state.announcement !== null
              ? `Slide ${state.announcement + 1} of 3: ${slides[state.announcement].title}`
              : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
