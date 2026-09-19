"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ShoppingCart,
  Package,
  CreditCard,
  CarFront,
  Home,
  LogOut,
  MessageSquare,
  Shield,
  Star,
  UserRound,
} from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  invalidateSession,
  SESSION_CHANGED,
} from "@/lib/api/client";
import type { SessionState } from "@/lib/api/types";
import { Brand } from "./brand";
import { Feedback } from "./feedback";
const links = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/vehicles", label: "My vehicles", icon: CarFront },
  { href: "/dashboard/inspections", label: "Inspections", icon: CalendarDays },
  { href: "/dashboard/vehicle-transactions", label: "Vehicle purchases", icon: CarFront },
  { href: "/dashboard/saved", label: "Saved items", icon: Star },
  { href: "/dashboard/cart", label: "Cart", icon: ShoppingCart },
  { href: "/dashboard/orders", label: "Orders", icon: Package },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/invoices", label: "Invoices", icon: Package },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/support", label: "Customer care", icon: MessageSquare },
  { href: "/dashboard/security", label: "Security", icon: Shield },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];
const adminLinks = [
  { href: "/admin", label: "Operations", icon: Home },
  { href: "/admin/inventory", label: "Parts inventory", icon: Package },
  { href: "/admin/bookings", label: "Workshop bookings", icon: CalendarDays },
  { href: "/admin/booking-slots", label: "Appointment slots", icon: CalendarDays },
  { href: "/admin/orders", label: "Order fulfilment", icon: Package },
  { href: "/admin/services", label: "Services", icon: CalendarDays },
  { href: "/admin/categories", label: "Part categories", icon: Package },
  { href: "/admin/products", label: "Parts catalogue", icon: ShoppingCart },
  { href: "/admin/branches", label: "Branches", icon: Home },
];
const SessionContext = createContext<SessionState | null>(null);
export function useAccountSession() {
  return useContext(SessionContext);
}
export function DashboardShell({
  children,
  audience = "customer",
}: {
  readonly children: React.ReactNode;
  readonly audience?: "customer" | "staff";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigation =
    audience === "staff"
      ? adminLinks.filter(
          (item) =>
            session?.user.role !== "STAFF" ||
            [
              "/admin",
              "/admin/orders",
              "/admin/bookings",
              "/admin/booking-slots",
              "/admin/inventory",
            ].includes(item.href),
        )
      : links;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void apiRequest<SessionState>("/auth/session", { signal: controller.signal })
      .then((r) => {
        if (!active) return;
        if (!r.data?.user?.id || typeof r.data.mfaRequired !== "boolean")
          throw new Error("Session response is unavailable. Please retry.");
        if (r.data.mfaRequired && !r.data.mfaVerifiedAt) {
          router.replace("/mfa");
          return;
        }
        if (audience === "customer" && r.data.user.role !== "CUSTOMER") {
          router.replace("/admin");
          return;
        }
        if (audience === "staff" && r.data.user.role === "CUSTOMER") {
          router.replace("/dashboard");
          return;
        }
        if (!["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"].includes(r.data.user.role))
          throw new Error("Unsupported account role");
        setSession(r.data);
        setError(null);
      })
      .catch((error_: unknown) => {
        if (active) {
          if (error_ instanceof ApiError && error_.status === 401)
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          else if (error_ instanceof ApiError && error_.code === "MFA_REQUIRED")
            router.replace("/mfa");
          else
            setError(
              error_ instanceof ApiError
                ? error_.message
                : "We could not verify your session. Please retry.",
            );
        }
      });
    function clear() {
      setSession(null);
      setError("Your session changed. Verify your account to continue.");
    }
    function revalidate() {
      if (document.visibilityState === "visible") {
        setSession(null);
        setRetry((value) => value + 1);
      }
    }
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("aat-session")
        : null;
    if (channel)
      channel.onmessage = () => {
        invalidateSession();
      };
    window.addEventListener(SESSION_CHANGED, clear);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      active = false;
      controller.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, clear);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [pathname, router, retry, audience]);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest<never>("/auth/logout", { method: "POST", csrf: true, body: {} });
      announceSessionChange();
      window.location.replace("/login");
    } catch {
      setError(
        "Sign-out could not be confirmed. Check your connection and try signing out again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <main className="section">
        <div className="container empty">
          {error ? (
            <>
              <Feedback message={error} />
              <button
                className="button"
                onClick={() => {
                  setError(null);
                  setRetry((value) => value + 1);
                }}
              >
                Verify session again
              </button>
              <p>
                <Link className="text-link" href="/login">
                  Go to sign in
                </Link>
              </p>
            </>
          ) : (
            "Verifying your session…"
          )}
        </div>
      </main>
    );
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link href="/">
          <Brand />
        </Link>
        <nav
          className="side-nav"
          aria-label={audience === "staff" ? "Administration" : "Customer dashboard"}
        >
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
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">
        <nav className="mobile-nav" aria-label="Customer dashboard mobile navigation">
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
        </nav>
        <header className="dashboard-top">
          <div>
            <span className="dashboard-kicker">
              {audience === "staff" ? "Operations workspace" : "Customer workspace"}
            </span>
            <strong>{session.user.email}</strong>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={16} /> Sign out
          </button>
        </header>
        <main id="main" className="dashboard-content" key={session.user.id}>
          <Feedback message={error} />
          <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        </main>
      </div>
    </div>
  );
}
