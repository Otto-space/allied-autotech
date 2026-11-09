"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import {
  HERO_IMAGE_TIMEOUT_MS,
  HERO_INTERVAL_MS,
  heroReducer,
  createHeroState,
} from "@/lib/hero-carousel";
import styles from "./home-hero.module.css";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const slides = [
  {
    image: "workshop-editorial",
    title: "Understand your vehicle’s condition.",
    copy: "Comprehensive diagnostics, with scan results explained by our team.",
    action: "View diagnostics",
    href: "/services?search=diagnostics",
  },
  {
    image: "family-editorial",
    title: "Care for everyday journeys.",
    copy: "Find maintenance and repairs, or tell our team what you have noticed about your vehicle.",
    action: "Explore services",
    href: "/services",
  },
  {
    image: "parts-editorial",
    title: "Find parts for your vehicle.",
    copy: "Browse parts and oils. Ask our team to confirm specifications, suitability and collection.",
    action: "Browse the Shop",
    href: "/parts",
  },
  {
    image: "showroom-neutral-editorial",
    title: "Explore your next vehicle.",
    copy: "See current listings, compare the details and ask our team about a vehicle or inspection.",
    action: "View vehicles",
    href: "/vehicles",
  },
] as const;

export function HomeHero() {
  const [state, dispatch] = useReducer(heroReducer, slides.length, createHeroState);
  const enhanced = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const [stopped, setStopped] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pointerStop = useRef<boolean | null>(null);
  const allFailed = state.failed.every(Boolean);
  const rotating = enhanced && !stopped && visible && inView && !allFailed;
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
      data-in-view={inView}
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
        <div className={styles.content}>
          {slides.map((slide, index) => {
            if (index !== 0 && !enhanced) return null;
            const active = index === state.current;
            const Title = active ? "h1" : "div";
            return (
              <div
                key={slide.image}
                className={styles.slide}
                data-active={active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}`}
                aria-hidden={!active}
                inert={!active}
              >
                <Title className={styles.title} id={active ? "home-title" : undefined}>
                  {slide.title}
                </Title>
                <p className={styles.copy}>{slide.copy}</p>
                <div className={styles.actions}>
                  <Link className="button" href={slide.href} data-hero-primary>
                    {slide.action} <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                  <Link className={styles.contactLink} href="/contact">
                    Talk to our team <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.visual}>
          <div className={styles.media}>
            {slides.map(
              (slide, index) =>
                (index === 0 || enhanced) && (
                  <Image
                    key={slide.image}
                    src={`/images/allied-autotech/${slide.image}.webp`}
                    alt=""
                    fill
                    sizes="100vw"
                    preload={index === 0}
                    loading={index === 0 ? undefined : "eager"}
                    className={styles.photo}
                    aria-hidden={index !== state.current}
                    data-current={index === state.current && !state.failed[index]}
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
              <span className={styles.unavailable}>Editorial image unavailable</span>
            )}
          </div>
          <div className={styles.controls}>
            {enhanced && (
              <>
                <button
                  type="button"
                  disabled={allFailed}
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
                  <span className="sr-only">{stopped ? "Play" : "Pause"}</span>
                </button>
                <div className={styles.pickers} role="group" aria-label="Choose a slide">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.image}
                      type="button"
                      disabled={allFailed}
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
                  disabled={allFailed}
                  aria-label="Previous slide"
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={allFailed}
                  aria-label="Next slide"
                  onClick={() => move(1)}
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {state.announcement !== null
            ? `Slide ${state.announcement + 1} of ${slides.length}: ${slides[state.announcement].title}`
            : ""}
        </span>
      </div>
    </section>
  );
}
