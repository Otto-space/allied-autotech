"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
const navigation = [
  { href: "/services", label: "Services" },
  { href: "/parts", label: "Parts" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/help", label: "Help centre" },
  { href: "/contact", label: "Contact" },
];
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
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
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login">Sign in</Link>
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
              { href: "/login", label: "Sign in" },
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
