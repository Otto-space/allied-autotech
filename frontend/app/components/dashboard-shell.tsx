"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  invalidateSession,
  isExternalSessionChange,
  SESSION_CHANGED,
} from "@/lib/api/client";
import type { SessionState } from "@/lib/api/types";
import { Brand } from "./brand";
import { Feedback } from "./feedback";
import { dashboardNavigation } from "@/lib/dashboard-navigation";
import { DashboardNavigation, DashboardPageSearch } from "./dashboard-navigation";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
const SessionContext = createContext<SessionState | null>(null);
const StaffPermissionContext = createContext<ReturnType<
  typeof useResource<ReturnType<typeof parseOwnStaffProfile>>
> | null>(null);
export function useAccountSession() {
  return useContext(SessionContext);
}
export function useOwnStaffPermissions() {
  const shared = useContext(StaffPermissionContext);
  const local = useResource(shared ? null : "/staff/profile", parseOwnStaffProfile);
  return shared ?? local;
}
export function DashboardShell({
  children,
  audience = "customer",
}: {
  readonly children: React.ReactNode;
  audience?: "customer" | "staff";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const menuOpen = menuPath === pathname;
  const grants = useResource(
    session?.user.role === "STAFF" ? "/staff/profile" : null,
    parseOwnStaffProfile,
  );
  const navigationCapabilities =
    !grants.error &&
    !grants.loading &&
    grants.data?.id === session?.user.id &&
    grants.data?.role === "STAFF" &&
    grants.data?.status === "ACTIVE"
      ? grants.data.capabilities
      : [];
  const navigation = session
    ? dashboardNavigation(session.user.role, navigationCapabilities)
    : [];
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 900px)");
    function adaptNavigation() {
      const focused = document.activeElement;
      if (mobile.matches) {
        setSidebarCollapsed(false);
        if (
          focused?.closest(
            ".dashboard-navigation-container, .dashboard-collapse-toggle, .dashboard-logout",
          )
        ) {
          setMenuPath(pathname);
          menuButton.current?.focus();
        }
      } else {
        setMenuPath(null);
        if (focused === menuButton.current) collapseButton.current?.focus();
      }
    }
    mobile.addEventListener("change", adaptNavigation);
    return () => mobile.removeEventListener("change", adaptNavigation);
  }, [pathname]);
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
      .catch((value: unknown) => {
        if (active) {
          if (value instanceof ApiError && value.status === 401)
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          else if (value instanceof ApiError && value.code === "MFA_REQUIRED")
            router.replace("/mfa");
          else
            setError(
              value instanceof ApiError
                ? value.message
                : "We could not verify your session. Please retry.",
            );
        }
      });
    function clear(event: Event) {
      const changedPassword =
        event instanceof CustomEvent && event.detail === "password-changed";
      setPasswordChanged(changedPassword);
      setSession(null);
      setError(
        changedPassword
          ? "Password changed. Other sessions were signed out. Verify your session to continue securely."
          : "Your session changed. Verify your account to continue.",
      );
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
      channel.onmessage = (event) => {
        if (isExternalSessionChange(event.data)) invalidateSession();
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
              <Feedback message={error} tone={passwordChanged ? "success" : "error"} />
              <button
                className="button"
                onClick={() => {
                  setError(null);
                  setPasswordChanged(false);
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
    <div
      className="dashboard"
      data-sidebar-collapsed={sidebarCollapsed}
      key={session.user.id}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuPath(null);
          menuButton.current?.focus();
        }
      }}
    >
      <aside className="sidebar" data-menu-open={menuOpen}>
        <div className="dashboard-brand-row">
          <Link href="/" aria-label="Allied AutoTech home">
            <Brand inverse />
          </Link>
          <button
            className="dashboard-collapse-toggle"
            ref={collapseButton}
            aria-controls="dashboard-navigation"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          <button
            className="dashboard-menu-toggle"
            ref={menuButton}
            aria-controls="dashboard-navigation"
            aria-expanded={menuOpen}
            aria-label={
              menuOpen ? "Close dashboard navigation" : "Open dashboard navigation"
            }
            onClick={() => setMenuPath(menuOpen ? null : pathname)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div id="dashboard-navigation" className="dashboard-navigation-container">
          <DashboardNavigation
            collapsed={sidebarCollapsed}
            onExpand={() => setSidebarCollapsed(false)}
            groups={navigation}
            pathname={pathname}
            onNavigate={() => setMenuPath(null)}
            label={audience === "staff" ? "Administration" : "Customer dashboard"}
          />
        </div>
        <button
          className="dashboard-logout"
          aria-label="Sign out"
          title="Sign out"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={20} aria-hidden="true" /> <span>Sign out</span>
        </button>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-top">
          <DashboardPageSearch groups={navigation} />
          <div className="dashboard-account-controls">
            <Link
              className="dashboard-icon-link"
              aria-label="Open notifications"
              href={
                audience === "staff" ? "/admin/notifications" : "/dashboard/notifications"
              }
              prefetch={false}
            >
              <Bell size={19} />
            </Link>
            <Link
              className="dashboard-account-link"
              aria-label="Open your account"
              href={audience === "staff" ? "/admin/security" : "/dashboard/profile"}
              prefetch={false}
            >
              <span className="dashboard-avatar" aria-hidden="true">
                <UserRound size={19} />
              </span>
              <span className="dashboard-account-email">{session.user.email}</span>
            </Link>
            <button
              className="dashboard-mobile-logout"
              disabled={busy}
              onClick={() => void logout()}
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main id="main" className="dashboard-content" key={session.user.id}>
          <Feedback message={error} />
          <SessionContext.Provider value={session}>
            <StaffPermissionContext.Provider
              value={session.user.role === "STAFF" ? grants : null}
            >
              {children}
            </StaffPermissionContext.Provider>
          </SessionContext.Provider>
        </main>
      </div>
    </div>
  );
}
