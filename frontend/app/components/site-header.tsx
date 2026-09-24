"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  Menu,
  ShoppingBag,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { z } from "zod";

import {
  apiRequest,
  ApiError,
  invalidateSession,
  isExternalSessionChange,
  SESSION_CHANGED,
} from "@/lib/api/client";

import { Brand } from "./brand";

const sessionSchema = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
  mfaRequired: z.boolean(),
  mfaVerifiedAt: z.string().nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
  idleExpiresAt: z.iso.datetime({ offset: true }),
});

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/parts", label: "Shop" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Support" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return <HeaderContent key={pathname} pathname={pathname} />;
}

function HeaderContent({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [session, setSession] = useState<z.infer<typeof sessionSchema> | null>(null);

  const menuButton = useRef<HTMLButtonElement>(null);

  /*
   * Header elevation / glass treatment
   */
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 12);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /*
   * Prevent background scrolling while mobile menu is open
   */
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const menu = document.getElementById("mobile-menu");
    // Wait for visibility/inert changes and the opener's native click focus.
    const frame = requestAnimationFrame(() => {
      menu?.querySelector<HTMLElement>("button, a[href]")?.focus({ preventScroll: true });
    });
    function trapFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key !== "Tab" || !menu) return;
      const controls = Array.from(
        menu.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !menu.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !menu.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapFocus);
    };
  }, [open]);

  /*
   * Desktop breakpoint handling
   */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1051px)");

    function resized() {
      if (!desktop.matches) return;

      const focusedMenu = document.activeElement?.closest("#mobile-menu");

      setOpen(false);

      if (focusedMenu) {
        document.querySelector<HTMLAnchorElement>(".site-header .nav-link")?.focus();
      }
    }

    desktop.addEventListener("change", resized);

    return () => {
      desktop.removeEventListener("change", resized);
    };
  }, []);

  /*
   * Session handling
   */
  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    let verified = false;
    let handlingUnauthorized = false;
    let lastChecked = 0;

    async function refresh() {
      if (!active || pending) return;

      const controller = new AbortController();

      pending = controller;
      lastChecked = Date.now();

      try {
        const response = await apiRequest("/auth/session", {
          optionalSession: true,
          signal: controller.signal,
        });

        const current = sessionSchema.parse(response.data);

        if (
          Date.parse(current.expiresAt) <= Date.now() ||
          Date.parse(current.idleExpiresAt) <= Date.now()
        ) {
          throw new Error("Expired session");
        }

        if (active && !controller.signal.aborted) {
          verified = true;
          setSession(current);
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;

        const hadSession = verified;

        verified = false;
        setSession(null);

        if (hadSession && error instanceof ApiError && error.status === 401) {
          handlingUnauthorized = true;
          invalidateSession();
          handlingUnauthorized = false;
        }
      } finally {
        if (pending === controller) {
          pending = null;
        }
      }
    }

    function changed() {
      if (handlingUnauthorized) return;

      verified = false;
      setSession(null);

      pending?.abort();
      pending = null;

      void refresh();
    }

    function visible() {
      if (document.visibilityState === "visible" && Date.now() - lastChecked >= 30_000) {
        void refresh();
      }
    }

    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("aat-session");

    if (channel) {
      channel.onmessage = (event) => {
        if (isExternalSessionChange(event.data)) {
          invalidateSession();
        }
      };
    }

    window.addEventListener(SESSION_CHANGED, changed);
    window.addEventListener("online", changed);
    document.addEventListener("visibilitychange", visible);

    void refresh();

    return () => {
      active = false;
      pending?.abort();
      channel?.close();

      window.removeEventListener(SESSION_CHANGED, changed);
      window.removeEventListener("online", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const accountLink = session
    ? {
        href: session.user.role === "CUSTOMER" ? "/dashboard" : "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
      }
    : {
        href: "/login",
        label: "Sign In",
        icon: LogIn,
      };

  const AccountIcon = accountLink.icon;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className={`site-header ${scrolled ? "site-header--scrolled" : ""}`}>
        <div className="site-header__inner">
          {/* BRAND */}
          <Link href="/" className="site-header__brand" aria-label="Allied AutoTech home">
            <Brand />
          </Link>

          {/* DESKTOP NAVIGATION */}
          <div className="site-header__desktop">
            <nav className="site-header__nav" aria-label="Primary navigation">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? "nav-link--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span>{item.label}</span>

                    {isActive && (
                      <span aria-hidden="true" className="nav-link__indicator" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="site-header__divider" />
            <Link
              href="/dashboard/cart"
              prefetch={false}
              className="site-cart-link"
              aria-label="Cart"
            >
              <ShoppingBag size={19} />
            </Link>

            <Link href={accountLink.href} prefetch={false} className="site-account-link">
              <span className="site-account-link__icon">
                <AccountIcon size={16} strokeWidth={2} />
              </span>

              <span>{accountLink.label}</span>
            </Link>

            <Link href="/services" className="header-book-button">
              <Wrench size={16} strokeWidth={2} />

              <span>Book a Service</span>

              <ArrowUpRight size={16} className="header-book-button__arrow" />
            </Link>
          </div>

          {/* MOBILE BUTTON */}
          <button
            ref={menuButton}
            type="button"
            className={`mobile-menu-button ${open ? "mobile-menu-button--open" : ""}`}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={21} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </header>

      {/* MOBILE BACKDROP */}
      <button
        type="button"
        className={`mobile-menu-backdrop ${open ? "mobile-menu-backdrop--visible" : ""}`}
        onClick={() => setOpen(false)}
        aria-label="Close navigation"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      />

      {/* MOBILE NAVIGATION */}
      <aside
        id="mobile-menu"
        className={`mobile-menu ${open ? "mobile-menu--open" : ""}`}
        aria-hidden={!open}
        inert={!open}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal={open ? true : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="mobile-menu__content">
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => {
              setOpen(false);
              menuButton.current?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
            Close menu
          </button>
          <div className="mobile-menu__eyebrow">
            <span className="mobile-menu__eyebrow-line" aria-hidden="true" />
            <span>Navigation</span>
          </div>

          <nav className="mobile-menu__nav" aria-label="Mobile primary navigation">
            {navigation.map((item, index) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${
                    isActive ? "mobile-nav-link--active" : ""
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="mobile-nav-link__number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span>{item.label}</span>

                  <ChevronRight
                    size={18}
                    className="mobile-nav-link__arrow"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>

          <div className="mobile-menu__account">
            <Link
              href="/dashboard/cart"
              className="mobile-account-link"
              prefetch={false}
              onClick={() => setOpen(false)}
            >
              <ShoppingBag size={18} />
              Cart
            </Link>
            <Link
              href={accountLink.href}
              prefetch={false}
              className="mobile-account-link"
              onClick={() => setOpen(false)}
            >
              <span className="mobile-account-link__icon">
                <UserRound size={18} aria-hidden="true" />
              </span>

              <span className="mobile-account-link__copy">
                <small>{session ? "Your account" : "Existing customer"}</small>

                <strong>{accountLink.label}</strong>
              </span>

              <ChevronRight size={18} aria-hidden="true" />
            </Link>

            {!session && (
              <Link
                href="/register"
                className="mobile-create-account"
                onClick={() => setOpen(false)}
              >
                Create an account
              </Link>
            )}
          </div>

          <Link
            href="/services"
            className="mobile-book-button"
            onClick={() => setOpen(false)}
          >
            <span className="mobile-book-button__copy">
              <small>Need vehicle care?</small>
              <strong>Book a Service</strong>
            </span>

            <span className="mobile-book-button__icon">
              <ArrowUpRight size={20} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
