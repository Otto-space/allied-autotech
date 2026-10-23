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
export function BrowserPushSettings({ role }: { role: string }) {
  const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/push`;
  const settings = useResource(base, parse);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [localEnabled, setLocalEnabled] = useState(false);
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
    if (supported)
      void navigator.serviceWorker
        .getRegistration("/")
        .then(async (registration) => {
          const sub = await registration?.pushManager.getSubscription();
          if (active) setLocalEnabled(!!sub && Notification.permission === "granted");
        })
        .catch(() => {
          if (active) setError("Unable to check this browser’s notification settings.");
        });
    const clear = () => {
      setLocalEnabled(false);
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED, clear);
    };
  }, []);
  const enabled = localEnabled || settings.data?.enabled;
  async function enable() {
    setError(undefined);
    setMessage(undefined);
    setBusy(true);
    try {
      // Permission is requested only after this explicit button click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          "Notifications are blocked or were dismissed. You can change this in your browser’s site settings.",
        );
        return;
      }
      if (!settings.data?.available || !settings.data.publicKey) return;
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
        await apiRequest(base, {
          method: "PUT",
          csrf: true,
          body: { endpoint: json.endpoint, keys: json.keys },
        });
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
      setMessage("Browser notifications are off on this device.");
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
        Get a discreet alert when there’s an update. Message contents stay inside your
        account. This setting applies to this browser and turns off when you sign out.
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
          Browser notifications are not available yet. Your in-app inbox will continue to
          receive updates.
        </p>
      ) : (
        <button
          className="button secondary"
          disabled={busy || !supported || !settings.data}
          onClick={() => void (enabled ? disable() : enable())}
        >
          {busy
            ? "Updating…"
            : enabled
              ? "Turn off on this device"
              : "Enable on this device"}
        </button>
      )}
    </section>
  );
}
