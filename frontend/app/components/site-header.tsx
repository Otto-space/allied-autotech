"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  apiRequest,
  ApiError,
  invalidateSession,
  isExternalSessionChange,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { z } from "zod";
import { Menu, X } from "lucide-react";
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
  { href: "/services", label: "Services" },
  { href: "/parts", label: "Parts" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/help", label: "Help centre" },
  { href: "/contact", label: "Contact" },
];
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<z.infer<typeof sessionSchema> | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1051px)");
    function resized() {
      if (!desktop.matches) return;
      const focusedMenu = document.activeElement?.closest("#mobile-menu");
      setOpen(false);
      if (focusedMenu)
        document.querySelector<HTMLAnchorElement>(".site-header .nav-links a")?.focus();
    }
    desktop.addEventListener("change", resized);
    return () => desktop.removeEventListener("change", resized);
  }, []);
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
        )
          throw new Error("Expired session");
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
        if (pending === controller) pending = null;
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
      if (document.visibilityState === "visible" && Date.now() - lastChecked >= 30_000)
        void refresh();
    }
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("aat-session");
    if (channel)
      channel.onmessage = (event) => {
        if (isExternalSessionChange(event.data)) invalidateSession();
      };
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
      }
    : { href: "/login", label: "Sign in" };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-row">
          <Link href="/" aria-label="Allied AutoTech home">
            <Brand />
          </Link>
          <nav className="nav-links" aria-label="Primary navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-ink relative ${isActive ? "text-ink" : "text-muted"}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-brand-red rounded-full" />
                  )}
                </Link>
              );
            })}
            <Link
              href={accountLink.href}
              prefetch={false}
              className="text-muted hover:text-ink ml-4 transition-colors"
            >
              {accountLink.label}
            </Link>
            <Link
              href="/services"
              className="button bg-ink hover:bg-brand-red text-white transition-colors"
            >
              Book a Service
            </Link>
          </nav>
          <button
            ref={menuButton}
            className="icon-button mobile-nav-action"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-menu"
            className="site-mobile-menu"
            aria-label="Mobile navigation"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            {[
              ...navigation,
              accountLink,
              ...(!session ? [{ href: "/register", label: "Create account" }] : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
