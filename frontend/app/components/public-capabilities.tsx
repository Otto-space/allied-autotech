"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/client";
import {
  capabilityKey,
  capabilityView,
  parsePublicCapabilities,
  type CapabilitySnapshot,
} from "@/lib/public-capabilities";

export const CAPABILITIES_CHANGED = "aat:capabilities-changed";
const unavailable = capabilityView(null);
const CapabilityContext = createContext(unavailable);

export function usePublicCapabilities() {
  return useContext(CapabilityContext);
}

export function PublicCapabilitiesProvider({
  initial,
  children,
}: {
  initial: CapabilitySnapshot;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState(() => ({
    snapshot: initial,
    mode: initial?.release.mode ?? null,
  }));
  const [failed, setFailed] = useState(initial === null);
  const refreshRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    let current = true;
    let pending: AbortController | undefined;
    let key = capabilityKey(initial);
    function publish(value: CapabilitySnapshot) {
      if (!current) return;
      const nextKey = capabilityKey(value);
      setState((previous) => ({
        snapshot: value,
        mode: value?.release.mode ?? previous.mode,
      }));
      setFailed(value === null);
      if (key !== nextKey) {
        key = nextKey;
        window.dispatchEvent(new Event(CAPABILITIES_CHANGED));
        if (value) router.refresh();
      }
    }
    async function refresh(disableStale = true) {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      // Hide stale actions immediately; retain all form drafts and account state.
      if (disableStale) setState((previous) => ({ ...previous, snapshot: null }));
      if (!navigator.onLine) {
        publish(null);
        return;
      }
      try {
        const response = await apiRequest("/public/capabilities", {
          signal: controller.signal,
          timeoutMs: 6000,
        });
        const value = parsePublicCapabilities(response.data);
        if (!controller.signal.aborted) publish(value);
      } catch {
        if (!controller.signal.aborted) publish(null);
      }
    }
    function visible() {
      if (document.visibilityState === "visible") void refresh();
    }
    function offline() {
      pending?.abort();
      publish(null);
    }
    refreshRef.current = () => {
      void refresh();
    };
    window.addEventListener("focus", visible);
    window.addEventListener("pageshow", visible);
    window.addEventListener("online", visible);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, 30_000);
    if (!navigator.onLine || initial === null) void refresh();
    return () => {
      current = false;
      pending?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("pageshow", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [initial, router]);
  return (
    <CapabilityContext value={capabilityView(state.snapshot, state.mode)}>
      {failed && (
        <aside className="capability-notice" aria-label="Online availability">
          <p role="status">
            Online actions are temporarily unavailable. You can still browse or contact
            our team.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => refreshRef.current()}
          >
            Check availability again
          </button>
        </aside>
      )}
      {children}
    </CapabilityContext>
  );
}
