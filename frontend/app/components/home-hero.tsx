"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const slides = [
  {
    title: "Precision care.",
    emphasis: "Confidence on every road.",
    description:
      "Professional diagnostics, maintenance and repairs from a team built on trust and driven by quality.",
    action: "Book a Service",
    href: "/services",
    image: "/images/allied-autotech/workshop-editorial.webp",
    alt: "Editorial scene of a technician inspecting a dark SUV in a modern workshop",
    secondary: "Request a Quote",
    secondaryHref: "/contact#enquiry",
    caption: "Your vehicle. Our focus.",
    contain: false,
  },
  {
    title: "Find the car",
    emphasis: "that fits your life.",
    description:
      "Explore carefully presented vehicles for family life, daily movement, business and executive comfort.",
    action: "Explore Vehicles",
    href: "/vehicles",
    image: "/images/allied-autotech/showroom-editorial.webp",
    alt: "Editorial showroom scene with a silver sedan and dark SUV",
    secondary: "Request an Inspection",
    secondaryHref: "/vehicles#inventory",
    caption: "Technology that supports informed decisions.",
    contain: true,
  },
  {
    title: "Built for every",
    emphasis: "journey that matters.",
    description:
      "Family comfort, everyday confidence and room for the moments that make life yours. Start your next chapter with us.",
    action: "Discover Vehicles",
    href: "/vehicles",
    image: "/images/allied-autotech/family-editorial.webp",
    alt: "Editorial scene of an African family beside a white SUV",
    secondary: "Speak With Us",
    secondaryHref: "https://wa.me/2348136075567",
    caption: "Quality products. Professional vehicle care.",
    contain: false,
  },
  {
    title: "Quality parts.",
    emphasis: "Reliable performance.",
    description:
      "Find the right essentials for your vehicle. Browse available parts, oils and automotive products in our Shop.",
    action: "Visit the Shop",
    href: "/parts",
    image: "/images/allied-autotech/parts-editorial.webp",
    alt: "Editorial arrangement of brake components, filters and unlabelled oil containers",
    secondary: "Request a Quotation",
    secondaryHref: "/contact#enquiry",
    caption: "Care and support for your next move.",
    contain: false,
  },
] as const;
const subscribeMotion = (changed: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};
const motionSnapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeVisibility = (changed: () => void) => {
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
};

export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  const advancing = playing && !hovered && !reduced && visible;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = slides[index];
  function select(next: number) {
    setPlaying(false);
    setIndex((next + slides.length) % slides.length);
  }
  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % slides.length),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [advancing, index]);
  return (
    <section
      className={`home-hero home-hero--slide-${index}`}
      aria-roledescription="carousel"
      aria-label="Explore Allied AutoTech"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setPlaying(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          select(index + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch")
          touch.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
      onPointerUp={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y))
          select(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hero-media" key={current.image}>
        <Image
          src={current.image}
          alt={current.alt}
          fill
          sizes="100vw"
          preload={index === 0}
        />
      </div>
      <div className="public-wrap hero-layout">
        <div
          className="hero-copy"
          aria-live={advancing ? "off" : "polite"}
          aria-atomic="true"
        >
          <h1>
            {current.title}
            <br />
            <span>{current.emphasis}</span>
          </h1>
          <p>{current.description}</p>
          <div className="actions">
            <Link className="button" href={current.href}>
              {current.action}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button secondary" href={current.secondaryHref}>
              {current.secondary}
            </Link>
          </div>
        </div>
        <div className="hero-controls">
          <div className="hero-dots" aria-label="Choose a slide">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Show slide ${slideIndex + 1}: ${slide.action}`}
                aria-current={index === slideIndex ? "true" : undefined}
                onClick={() => select(slideIndex)}
              >
                <span>
                  <i
                    key={`${index}-${advancing}`}
                    className={index === slideIndex && advancing ? "is-advancing" : ""}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="hero-arrows">
            <span className="hero-count" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} / 04
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => select(index - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => select(index + 1)}
            >
              <ChevronRight size={20} />
            </button>
            {!reduced && (
              <button
                type="button"
                aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
