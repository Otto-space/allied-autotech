"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import type { SessionState } from "@/lib/api/types";
const navigation = [
  { href: "/services", label: "Services" },
  { href: "/parts", label: "Parts" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/about", label: "About" },
];
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState | null>(null);
  const destination =
    session?.user.role === "CUSTOMER" ? "/dashboard" : session ? "/admin" : "/login";
  useEffect(() => {
    let active = true;
    const load = () =>
      void apiRequest<SessionState>("/auth/session")
        .then((result) => {
          if (active && result.data?.user?.id) setSession(result.data);
        })
        .catch(() => {
          if (active) setSession(null);
        });
    void load();
    const refresh = () => void load();
    window.addEventListener(SESSION_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED, refresh);
    };
  }, []);
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
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "page"
                    : undefined
                }
              >
                {item.label}
              </Link>
            ))}
            <Link href={destination}>{session ? "Dashboard" : "Sign in"}</Link>
            <a href="https://wa.me/2348136075567" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <Link href="/services" className="button">
              Book a service <span aria-hidden="true">↗</span>
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
              { href: destination, label: session ? "Dashboard" : "Sign in" },
              { href: "/register", label: "Create account" },
            ].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
