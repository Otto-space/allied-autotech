"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { clearBrowserPush } from "@/lib/notifications/browser-push";
import { Feedback } from "./feedback";
const schema = z.object({
  available: z.boolean(),
  publicKey: z.string().nullable(),
  enabled: z.boolean(),
});
const parse = (value: unknown) => schema.parse(value);
export function BrowserPushSettings({ role, userId }: { role: string; userId: string }) {
  const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/push`;
  const settings = useResource(base, parse);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    let active = true;
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
      setOnline(navigator.onLine);
      if (supported) {
        setPermission(Notification.permission);
        await navigator.serviceWorker
          .getRegistration("/")
          .then(async (registration) => {
            const sub = await registration?.pushManager.getSubscription();
            const worker = registration?.active ?? registration?.waiting;
            if (active)
              setLocalEnabled(
                !!sub &&
                  !!worker &&
                  new URL(worker.scriptURL).pathname === "/push-sw.js" &&
                  Notification.permission === "granted",
              );
          })
          .catch(() => {
            if (active) setError("Unable to check this browser’s notification settings.");
          });
      }
    }
    void check();
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    const clear = () => {
      setLocalEnabled(false);
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
    localEnabled && permission === "granted" && settings.data?.enabled === true;
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
      try {
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
          Notification.permission !== "granted"
        )
          throw new Error("Device binding not confirmed");
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setLocalEnabled(true);
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
      setLocalEnabled(false);
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
  return (
    <section className="cn-browser-push" aria-labelledby="browser-push-heading">
      <h3 id="browser-push-heading">Browser notifications</h3>
      <p>
        Background Web Push can show a discreet alert while the site is closed, where
        supported. Message contents stay inside your account. This applies to this
        signed-in browser session and stops when you sign out or the session expires.
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
