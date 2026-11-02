"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./browser-push-invitation.module.css";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { clearBrowserPush } from "@/lib/notifications/browser-push";
import { Feedback } from "./feedback";
const schema = z.object({
  available: z.boolean(),
  publicKey: z.string().nullable(),
  enabled: z.boolean(),
  endpointHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).optional(),
});
const parse = (value: unknown) => schema.parse(value);
async function endpointFingerprint(endpoint: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export function BrowserPushSettings({
  role,
  userId,
  invitationHref,
}: {
  role: string;
  userId: string;
  invitationHref?: string;
}) {
  const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/push`;
  const settings = useResource(base, parse);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const dismissalKey = `allied:push-invitation:v1:${role}:${userId}`;
  useEffect(() => {
    if (!invitationHref) return;
    let active = true;
    queueMicrotask(() => {
      let hidden = false;
      try {
        hidden = sessionStorage.getItem(dismissalKey) === "dismissed";
      } catch {
        /* In-memory dismissal still works. */
      }
      if (active) setDismissed(hidden);
    });
    return () => {
      active = false;
    };
  }, [invitationHref, dismissalKey]);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [localFingerprint, setLocalFingerprint] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    let active = true;
    let checkVersion = 0;
    const supported =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    queueMicrotask(() => {
      if (active) setSupported(supported);
    });
    async function check() {
      if (!active) return;
      const version = ++checkVersion;
      setOnline(navigator.onLine);
      if (supported) {
        setPermission(Notification.permission);
        await navigator.serviceWorker
          .getRegistration("/")
          .then(async (registration) => {
            const sub = await registration?.pushManager.getSubscription();
            const worker = registration?.active ?? registration?.waiting;
            const fingerprint =
              sub &&
              !!worker &&
              new URL(worker.scriptURL).pathname === "/push-sw.js" &&
              Notification.permission === "granted"
                ? await endpointFingerprint(sub.endpoint)
                : null;
            if (active && version === checkVersion) setLocalFingerprint(fingerprint);
          })
          .catch(() => {
            if (active && version === checkVersion) {
              setLocalFingerprint(null);
              setError("Unable to check this browser’s notification settings.");
            }
          });
        if (active && version === checkVersion) setDeviceChecked(true);
      }
    }
    void check();
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    const clear = () => {
      checkVersion++;
      setLocalFingerprint(null);
      setDeviceChecked(false);
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED, clear);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);
  const enabled =
    !!localFingerprint &&
    permission === "granted" &&
    settings.data?.enabled === true &&
    settings.data.endpointHashes?.includes(localFingerprint) === true;
  async function enable() {
    setError(undefined);
    setMessage(undefined);
    setBusy(true);
    try {
      // Permission is requested only after this explicit button click.
      const result =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage(
          "Notifications are blocked or were dismissed. You can change this in your browser’s site settings.",
        );
        return;
      }
      if (!settings.data?.available || !settings.data.publicKey) return;
      const session = z
        .object({ user: z.object({ id: z.string(), role: z.string() }) })
        .parse((await apiRequest("/auth/session")).data);
      if (session.user.id !== userId || session.user.role !== role)
        throw new Error("Account changed");
      const previous = await navigator.serviceWorker.getRegistration("/");
      const worker = previous?.active ?? previous?.waiting ?? previous?.installing;
      if (worker && new URL(worker.scriptURL).pathname !== "/push-sw.js")
        throw new Error("Existing site worker must be preserved");
      await clearBrowserPush();
      await navigator.serviceWorker.register("/push-sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const registration = await navigator.serviceWorker.ready;
      const key = settings.data.publicKey.replaceAll("-", "+").replaceAll("_", "/");
      const bytes = Uint8Array.from(
        atob(key + "=".repeat((4 - (key.length % 4)) % 4)),
        (char) => char.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      let fingerprint: string;
      try {
        fingerprint = await endpointFingerprint(subscription.endpoint);
        const json = subscription.toJSON();
        const response = await apiRequest(base, {
          method: "PUT",
          csrf: true,
          body: { endpoint: json.endpoint, keys: json.keys },
        });
        z.object({ enabled: z.literal(true) }).parse(response.data);
        const confirmed = parse((await apiRequest(base)).data);
        if (
          !confirmed.enabled ||
          !confirmed.available ||
          !confirmed.endpointHashes?.includes(fingerprint) ||
          Notification.permission !== "granted"
        )
          throw new Error("Device binding not confirmed");
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setLocalFingerprint(fingerprint);
      settings.refresh();
      setMessage("Browser notifications are on for this signed-in device.");
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "We couldn’t enable browser notifications. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setError(undefined);
    setMessage(undefined);
    setBusy(true);
    try {
      await apiRequest(base, { method: "DELETE", csrf: true, body: {} });
      await clearBrowserPush();
      setLocalFingerprint(null);
      settings.refresh();
      setMessage(
        "Browser notifications are off on this device. Your browser’s site permission is unchanged.",
      );
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "We couldn’t confirm the change. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (invitationHref) {
    if (dismissed === false && (message || error))
      return (
        <section className={styles.invitation} aria-label="Browser notification update">
          <p role="status">{message || error}</p>
          <Link className="button secondary" href={invitationHref}>
            Review notification settings
          </Link>
        </section>
      );
    if (
      dismissed !== false ||
      !deviceChecked ||
      !supported ||
      !online ||
      permission === "denied" ||
      enabled ||
      error ||
      settings.loading ||
      settings.refreshing ||
      settings.error ||
      settings.refreshError ||
      !settings.data?.available ||
      !settings.data.publicKey
    )
      return null;
    return (
      <section className={styles.invitation} aria-labelledby="push-invitation-title">
        <h2 id="push-invitation-title">Would you like browser alerts?</h2>
        <p>
          Get updates about your bookings and orders on this device. Your browser asks for
          permission only after you choose Enable notifications.
        </p>
        <div className={styles.actions}>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
          <Link className="button secondary" href={invitationHref}>
            Review notification settings
          </Link>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDismissed(true);
              const heading = document.querySelector<HTMLElement>("main h1");
              if (heading) {
                heading.tabIndex = -1;
                heading.focus();
              }
              try {
                sessionStorage.setItem(dismissalKey, "dismissed");
              } catch {
                /* Keep the choice in memory. */
              }
            }}
          >
            Not now
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="cn-browser-push" aria-labelledby="browser-push-heading">
      <h3 id="browser-push-heading" tabIndex={-1}>
        Browser notifications
      </h3>
      <p>
        Browser alerts use Web Push where supported. Delivery depends on this browser,
        your permission and your signed-in session. Message contents stay inside your
        account. This applies to this signed-in browser session and stops when you sign
        out or the session expires.
      </p>
      <Feedback message={error ?? settings.error} />
      {message && <p role="status">{message}</p>}
      {supported === false ? (
        <p>
          This browser cannot receive push notifications. On iPhone or iPad, add Allied
          AutoTech to your Home Screen and open it from there.
        </p>
      ) : settings.data?.available === false ? (
        <p>
          Background push is not configured for this environment. While this site is open,
          the bell checks for updates. Your in-app inbox remains available.
        </p>
      ) : (
        <>
          <p role="status">
            {!online
              ? "You’re offline. Reconnect to update this device."
              : permission === "denied"
                ? "Blocked in this browser. Change notification permission in site settings; we will not ask again."
                : enabled
                  ? "On for this signed-in browser."
                  : settings.data?.enabled
                    ? "This browser’s permission or subscription changed. Reconnect it or turn off the saved binding."
                    : permission === "granted"
                      ? "Permission granted. Enable this account on this browser to receive alerts."
                      : "Off. Your browser will ask for permission only when you choose Enable."}
          </p>
          <button
            className="button secondary"
            disabled={
              busy ||
              !online ||
              !supported ||
              !settings.data ||
              !!settings.error ||
              !!settings.refreshError ||
              (permission === "denied" && !settings.data.enabled)
            }
            onClick={() =>
              void (enabled || (permission === "denied" && settings.data?.enabled)
                ? disable()
                : enable())
            }
          >
            {busy
              ? "Updating…"
              : enabled || (permission === "denied" && settings.data?.enabled)
                ? "Turn off on this device"
                : "Enable on this device"}
          </button>
          {!enabled && settings.data?.enabled && permission !== "denied" && (
            <button
              className="button secondary"
              disabled={busy || !online}
              onClick={() => void disable()}
            >
              Turn off saved device binding
            </button>
          )}
        </>
      )}
    </section>
  );
}
