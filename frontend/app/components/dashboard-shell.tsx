"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound, X } from "lucide-react";
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
import { parseWorkforceAccess } from "@/lib/api/workforce-schemas";
import { workforceNavigation } from "@/lib/workforce-navigation";
import { WorkforceWorkspace, useWorkforceRefresh } from "./workforce-workspace";
import { useNotificationSummary } from "@/lib/notifications/use-notification-summary";
import {
  notificationNavigationCounts,
  notificationNavigationLinks,
} from "@/lib/notifications/destinations";
import { NotificationPreview } from "./notification-preview";
import { NotificationAccessContext } from "@/lib/notifications/access-context";
import { containDialogFocus } from "@/lib/dialog-focus";
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
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const menuOpen = menuPath === pathname;
  const workforce = useResource(
    session?.workforceManaged ? "/staff/workforce/access" : null,
    parseWorkforceAccess,
  );
  useWorkforceRefresh(workforce.refresh, workforce.data);
  // Retain a mounted workspace while a fresh check is pending. It stays hidden
  // and inert until verified; failures and scope changes still discard it.
  const retainedWorkforce =
    session?.workforceManaged &&
    !workforce.error &&
    !workforce.refreshError &&
    workforce.data?.managed &&
    workforce.data.userId === session.user.id
      ? workforce.data
      : undefined;
  const verifiedWorkforce = !workforce.loading ? retainedWorkforce : undefined;
  const notifications = useNotificationSummary(session && (!session.workforceManaged || verifiedWorkforce) ? session : null);
  const unreadCount = notifications?.data?.unreadCount ?? 0;
  const grants = useResource(
    session?.user.role === "STAFF" && !session.workforceManaged ? "/staff/profile" : null,
    parseOwnStaffProfile,
  );
  const navigationCapabilities =
    !grants.error &&
    !grants.refreshError &&
    !grants.loading &&
    grants.data?.id === session?.user.id &&
    grants.data?.role === "STAFF" &&
    grants.data?.status === "ACTIVE"
      ? grants.data.capabilities
      : [];
  const navigation = session?.workforceManaged
    ? verifiedWorkforce
      ? workforceNavigation(verifiedWorkforce)
      : []
    : session
      ? dashboardNavigation(session.user.role, navigationCapabilities)
      : [];
  const currentDestination = navigation
    .flatMap((group) => group.links.map((link) => ({ ...link, group: group.label })))
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const notificationAccess = {
    managed: !!session?.workforceManaged,
    links: navigation.flatMap((group) => group.links.map((link) => link.href)),
  };
  const unreadLinks = notificationNavigationCounts(
    notifications?.data,
    audience === "customer",
    notificationAccess,
  );
  useEffect(() => {
    const dialog = mobileDialog.current;
    const opener = menuButton.current;
    if (!menuOpen || !dialog) return;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (window.matchMedia("(max-width: 900px)").matches) opener?.focus();
    };
  }, [menuOpen, session]);
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
          setSession(null);
          router.replace("/mfa");
          return;
        }
        if (audience === "customer" && r.data.user.role !== "CUSTOMER") {
          setSession(null);
          router.replace("/admin");
          return;
        }
        if (audience === "staff" && r.data.user.role === "CUSTOMER") {
          setSession(null);
          router.replace("/dashboard");
          return;
        }
        if (!["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"].includes(r.data.user.role))
          throw new Error("Unsupported account role");
        setSession(r.data);
        setError(null);
      })
      .catch((value: unknown) => {
        if (active && !controller.signal.aborted) {
          if (value instanceof ApiError && value.status === 401) {
            setSession(null);
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          } else if (value instanceof ApiError && value.code === "MFA_REQUIRED") {
            setSession(null);
            router.replace("/mfa");
          } else {
            if (!(value instanceof ApiError) || (value.status > 0 && value.status < 500))
              setSession(null);
            setError(
              value instanceof ApiError
                ? value.message
                : "We could not verify your session. Please retry.",
            );
          }
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
        // Recheck in place: unmounting here discards every unfinished form.
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
              <h1>Dashboard access unavailable</h1>
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
            <>
              <h1>Opening your dashboard</h1>
              <p role="status">Verifying your session…</p>
            </>
          )}
        </div>
      </main>
    );
  return (
    <div
      className="dashboard"
      data-sidebar-collapsed={sidebarCollapsed}
      key={`${session.id}:${session.user.id}:${session.user.role}:${pathname}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuPath(null);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
            aria-controls="dashboard-mobile-navigation"
            aria-expanded={menuOpen}
            aria-label="Open dashboard navigation"
            onClick={() => setMenuPath(menuOpen ? null : pathname)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div id="dashboard-navigation" className="dashboard-navigation-container">
          <DashboardNavigation
            collapsed={sidebarCollapsed}
            unreadCounts={unreadLinks}
            unreadLinks={notificationNavigationLinks(notifications?.data)}
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
      <dialog
        ref={mobileDialog}
        className="dashboard-drawer"
        aria-label="Dashboard navigation"
        onKeyDown={containDialogFocus}
        onCancel={() => setMenuPath(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right)
              setMenuPath(null);
          }
        }}
      >
        <div className="dashboard-drawer-heading">
          <Brand inverse />
          <button
            type="button"
            aria-label="Close dashboard navigation"
            onClick={() => setMenuPath(null)}
          >
            <X size={20} />
          </button>
        </div>
        <div id="dashboard-mobile-navigation" className="dashboard-drawer-content">
          <DashboardNavigation
            groups={navigation}
            unreadCounts={unreadLinks}
            unreadLinks={notificationNavigationLinks(notifications?.data)}
            pathname={pathname}
            onNavigate={() => setMenuPath(null)}
            label={audience === "staff" ? "Administration" : "Customer dashboard"}
          />
        </div>
        <button
          className="dashboard-drawer-logout"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </dialog>
      <div className="dashboard-main">
        <header className="dashboard-top">
          <DashboardPageSearch groups={navigation} />
          <div className="dashboard-account-controls">
            {(!session.workforceManaged || verifiedWorkforce) && (
              <NotificationPreview
                key={`${session.id}:${session.user.id}:${session.user.role}:${pathname}`}
                customer={audience === "customer"}
                count={unreadCount}
                unavailable={notifications?.unavailable}
                pending={!notifications}
              />
            )}
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
          {currentDestination &&
            !(
              session.workforceManaged &&
              (pathname === "/admin" || pathname === "/admin/workforce")
            ) &&
            pathname !== "/dashboard/bookings" &&
            pathname !== "/dashboard/orders" &&
            pathname !== "/dashboard/payments" &&
            pathname !== "/admin/payments" &&
            pathname !== "/admin/invoices" &&
            !/^\/admin\/invoices\/[^/]+$/.test(pathname) &&
            pathname !== "/dashboard/invoices" &&
            pathname !== "/dashboard/vehicles" &&
            pathname !== "/dashboard/inspections" &&
            pathname !== "/dashboard/vehicle-transactions" &&
            !/^\/dashboard\/vehicle-transactions\/[^/]+$/.test(pathname) &&
            !/^\/dashboard\/vehicles\/[^/]+$/.test(pathname) &&
            !/^\/dashboard\/bookings\/[^/]+$/.test(pathname) &&
            !/^\/dashboard\/invoices\/[^/]+$/.test(pathname) &&
            !/^\/dashboard\/support\/(enquiries|complaints)\/[^/]+$/.test(pathname) &&
            !/^\/dashboard\/orders\/[^/]+\/aftercare$/.test(pathname) &&
            pathname !== "/admin/bookings" &&
            pathname !== "/admin/workforce/jobs" &&
            pathname !== "/admin/workforce/bookings" &&
            pathname !== "/admin/workforce/enquiries" &&
            pathname !== "/admin/workforce/complaints" &&
            pathname !== "/admin/workforce/orders" &&
            pathname !== "/admin/workforce/finance" &&
            !/^\/admin\/workforce\/jobs\/[^/]+$/.test(pathname) &&
            pathname !== "/admin/booking-slots" &&
            pathname !== "/admin/services" &&
            pathname !== "/admin/products" &&
            pathname !== "/admin/fitment" &&
            pathname !== "/admin/categories" &&
            pathname !== "/admin/orders" &&
            pathname !== "/admin/inventory" &&
            pathname !== "/admin/promotions" &&
            pathname !== "/admin/vehicles" &&
            pathname !== "/admin/inspections" &&
            pathname !== "/admin/vehicle-sales" &&
            pathname !== "/admin/customers" &&
            pathname !== "/admin/support" &&
            pathname !== "/admin/privacy" &&
            pathname !== "/admin/reviews" &&
            pathname !== "/admin/refunds" &&
            pathname !== "/admin/payment-exceptions" &&
            pathname !== "/admin/payment-disputes" &&
            pathname !== "/admin/payment-disputes/work" &&
            !/^\/admin\/support\/(enquiries|complaints)\/[^/]+$/.test(pathname) &&
            !/^\/admin\/customers\/[^/]+$/.test(pathname) &&
            !/^\/admin\/staff\/[0-9a-f-]{36}$/i.test(pathname) &&
            pathname !== "/admin/staff/invite" &&
            pathname !== "/admin/branches" &&
            pathname !== "/admin/audit" &&
            pathname !== "/admin/processing-jobs" &&
            pathname !== "/admin/complaint-policy" &&
            pathname !== "/admin/dispute-policy" &&
            pathname !== "/admin/retention-policy" &&
            pathname !== "/admin/booking-capacity" &&
            pathname !== "/admin/delivery-policy" &&
            pathname !== "/admin/reservation-terms" &&
            pathname !== "/admin/refund-timing" &&
            pathname !== "/admin/notifications" &&
            !/^\/admin\/vehicle-sales\/[^/]+$/.test(pathname) &&
            pathname !== "/admin/vehicles/new" &&
            !/^\/admin\/vehicles\/[^/]+$/.test(pathname) &&
            pathname !== "/admin/promotions/new" &&
            !/^\/admin\/promotions\/[^/]+$/.test(pathname) &&
            !/^\/admin\/inventory\/[^/]+$/.test(pathname) &&
            !/^\/admin\/orders\/[^/]+$/.test(pathname) &&
            !/^\/admin\/orders\/[^/]+\/aftercare$/.test(pathname) &&
            !/^\/admin\/categories\/[^/]+$/.test(pathname) &&
            !/^\/admin\/products\/[^/]+$/.test(pathname) &&
            !/^\/admin\/services\/[^/]+$/.test(pathname) &&
            !/^\/admin\/service-categories\/[^/]+$/.test(pathname) &&
            !/^\/admin\/bookings\/[^/]+$/.test(pathname) &&
            pathname !== (audience === "staff" ? "/admin" : "/dashboard") && (
              <nav className="breadcrumbs dashboard-breadcrumbs" aria-label="Breadcrumb">
                <Link href={audience === "staff" ? "/admin" : "/dashboard"}>
                  Overview
                </Link>
                <span aria-hidden="true">/</span>
                {pathname === currentDestination.href ? (
                  <span>{currentDestination.label}</span>
                ) : (
                  <>
                    <Link href={currentDestination.href}>{currentDestination.label}</Link>
                    <span aria-hidden="true">/</span>
                    <span>Details</span>
                  </>
                )}
              </nav>
            )}
          <Feedback message={error} />
          {session.user.role === "STAFF" &&
            !session.workforceManaged &&
            (grants.error || grants.refreshError) && (
              <section aria-label="Work access check">
                <Feedback message="We could not verify your current work permissions. Work page links are unavailable until you retry." />
                <button
                  className="button secondary"
                  onClick={grants.refresh}
                  disabled={grants.loading}
                >
                  Retry work permissions
                </button>
              </section>
            )}
          <SessionContext.Provider value={session}>
            <NotificationAccessContext.Provider value={notificationAccess}>
              <StaffPermissionContext.Provider
                value={session.user.role === "STAFF" ? grants : null}
              >
                {session.workforceManaged ? (
                  <>
                    {retainedWorkforce && (
                      <div hidden={!verifiedWorkforce} inert={!verifiedWorkforce}>
                        {pathname === "/admin/security" ||
                        pathname === "/admin/notifications" ? (
                          children
                        ) : (
                          <WorkforceWorkspace
                            key={JSON.stringify([
                              retainedWorkforce.userId,
                              retainedWorkforce.version,
                              retainedWorkforce.assignments.map((a) => a.id),
                            ])}
                            access={retainedWorkforce}
                            refreshAccess={workforce.refresh}
                          />
                        )}
                      </div>
                    )}
                    {!verifiedWorkforce && (
                      <>
                        {workforce.error || workforce.refreshError ? (
                          <>
                            <h1>Work access unavailable</h1>
                            <Feedback
                              message={workforce.error || workforce.refreshError}
                            />
                            <p>
                              We could not verify your current responsibilities. Retry
                              before continuing with work records.
                            </p>
                          </>
                        ) : (
                          <>
                            <h1>Checking work access</h1>
                            <p role="status">Checking current responsibility access…</p>
                          </>
                        )}
                        <button
                          className="button secondary"
                          onClick={workforce.refresh}
                          disabled={workforce.loading}
                        >
                          Retry access check
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  children
                )}
              </StaffPermissionContext.Provider>
            </NotificationAccessContext.Provider>
          </SessionContext.Provider>
        </main>
      </div>
    </div>
  );
}
