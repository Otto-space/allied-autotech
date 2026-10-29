import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function HomeHero() {
  return (
    <section className="home-hero home-hero--static" aria-labelledby="home-title">
      <div className="hero-media">
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
  const heroRef = useRef<HTMLElement>(null);
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
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const handleMouseEnter = () => setHovered(true);
    const handleMouseLeave = () => setHovered(false);
    const handleFocus = () => setPlaying(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        select(index + (event.key === "ArrowRight" ? 1 : -1));
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch")
        touch.current = { x: event.clientX, y: event.clientY };
    };
    const handlePointerCancel = () => {
      touch.current = null;
    };
    const handlePointerUp = (event: PointerEvent) => {
      const start = touch.current;
      touch.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y))
        select(index + (dx < 0 ? 1 : -1));
    };

    hero.addEventListener("mouseenter", handleMouseEnter);
    hero.addEventListener("mouseleave", handleMouseLeave);
    hero.addEventListener("focusin", handleFocus);
    hero.addEventListener("keydown", handleKeyDown);
    hero.addEventListener("pointerdown", handlePointerDown);
    hero.addEventListener("pointercancel", handlePointerCancel);
    hero.addEventListener("pointerup", handlePointerUp);
    return () => {
      hero.removeEventListener("mouseenter", handleMouseEnter);
      hero.removeEventListener("mouseleave", handleMouseLeave);
      hero.removeEventListener("focusin", handleFocus);
      hero.removeEventListener("keydown", handleKeyDown);
      hero.removeEventListener("pointerdown", handlePointerDown);
      hero.removeEventListener("pointercancel", handlePointerCancel);
      hero.removeEventListener("pointerup", handlePointerUp);
    };
  }, [index]);
  return (
    <section
      ref={heroRef}
      className={`home-hero home-hero--slide-${index}`}
      aria-roledescription="carousel"
      aria-label="Explore Allied AutoTech"
    >
      <div className="hero-media" key={current.image}>
        <Image
          src="/images/allied-autotech/workshop-editorial.webp"
          alt="Editorial scene of a technician inspecting a dark SUV in a workshop"
          fill
          sizes="100vw"
          preload
        />
        <p className="hero-caption hero-credit">Editorial workshop illustration.</p>
      </div>
      <div className="public-wrap hero-layout">
        <div className="hero-copy">
          <p className="hero-eyebrow">Allied AutoTech · Port Harcourt</p>
          <h1 id="home-title">Diagnostics, repairs and automotive essentials.</h1>
          <p>
            Explore our services, find automotive products or speak to our team about a
            vehicle.
          </p>
          <div className="actions">
            <Link className="button" href="/services">
              Explore services <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button secondary" href="/contact#enquiry">
              Contact the team
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
