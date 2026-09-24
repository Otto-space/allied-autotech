"use client";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const slides = [
  {
    title: "Built on Trust. Driven by Quality.",
    description:
      "Professional maintenance, diagnostics, tyre services and automotive solutions in Port Harcourt.",
    action: "Book a Service",
    href: "/services",
    image: "/images/workshop/workshop-hero-01.jpg",
    alt: "Vehicles being serviced inside Allied AutoTech",
    caption: "Your vehicle. Our focus.",
    contain: false,
  },
  {
    title: "A clearer picture of your vehicle’s health.",
    description:
      "Modern diagnostic equipment and practical expertise help us investigate the fault and explain the next step.",
    action: "Explore Diagnostics",
    href: "/services",
    image: "/images/equipment/autel-mk808s.jpg",
    alt: "Autel MK808S diagnostic tablet and case",
    caption: "Technology that supports informed decisions.",
    contain: true,
  },
  {
    title: "Automotive essentials for the road ahead.",
    description:
      "Explore our Shop for genuine parts, oils, maintenance products and other automotive essentials.",
    action: "Visit Shop",
    href: "/parts",
    image: "/images/workshop/workshop-hero-02.jpg",
    alt: "Tyre and wheel work at the Allied AutoTech workshop",
    caption: "Quality products. Professional vehicle care.",
    contain: false,
  },
  {
    title: "Vehicle solutions, with confidence.",
    description:
      "Browse our published vehicle listings and talk to our team about inspections, enquiries and sourcing.",
    action: "Browse Vehicles",
    href: "/vehicles",
    image: "/images/workshop/workshop-hero-04.jpg",
    alt: "A vehicle at an Allied AutoTech service lift",
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

export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = slides[index];
  function select(next: number) {
    setPlaying(false);
    setIndex((next + slides.length) % slides.length);
  }
  useEffect(() => {
    if (!playing || hovered || reduced) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((value) => (value + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [playing, hovered, reduced]);
  return (
    <section
      className="home-hero"
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
      <div className="public-wrap hero-layout">
        <div
          className="hero-copy"
          aria-live={playing ? "off" : "polite"}
          aria-atomic="true"
        >
          <h1>{current.title}</h1>
          <p>{current.description}</p>
          <div className="actions">
            <Link className="button" href={current.href}>
              {current.action}
            </Link>
            <Link className="text-link" href="/about">
              Meet Allied AutoTech
            </Link>
          </div>
        </div>
        <figure className="hero-figure">
          <div className={`hero-photo ${current.contain ? "hero-photo--contain" : ""}`}>
            <Image
              key={current.image}
              src={current.image}
              alt={current.alt}
              fill
              sizes="(max-width: 800px) 100vw, 54vw"
              preload={index === 0}
            />
          </div>
          <figcaption>{current.caption}</figcaption>
        </figure>
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
                <span />
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
