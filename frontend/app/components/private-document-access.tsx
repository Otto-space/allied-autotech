"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { trustedAssetUrl } from "@/lib/assets";
import { useAssetStorageHosts } from "./asset-storage-context";
import { Feedback } from "./feedback";
const accessSchema = z.object({
  url: z.string(),
  expiresInSeconds: z.number().int().positive().max(86400),
});
export function PrivateDocumentAccess({
  path,
  disabled = false,
  label = "signed document",
}: {
  path: string;
  disabled?: boolean;
  label?: string;
}) {
  const hosts = useAssetStorageHosts();
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [access, setAccess] = useState<{
    path: string;
    url: string;
    expiresAt: number;
  }>();
  const currentAccess = access?.path === path ? access : undefined;
  useEffect(() => {
    const clear = () => {
      pending.current?.abort();
      setAccess(undefined);
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, clear);
    };
  }, [path]);
  useEffect(() => {
    if (!access) return;
    const clearExpired = () => {
      if (Date.now() >= access.expiresAt) setAccess(undefined);
    };
    const timer = setTimeout(clearExpired, Math.max(0, access.expiresAt - Date.now()));
    document.addEventListener("visibilitychange", clearExpired);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", clearExpired);
    };
  }, [access]);
  async function requestAccess() {
    if (pending.current || disabled || !hosts.length) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setAccess(undefined);
    try {
      const startedAt = Date.now();
      const response = await apiRequest(path, {
        method: "POST",
        csrf: true,
        body: {},
        signal: controller.signal,
      });
      const data = accessSchema.parse(response.data);
      const url = trustedAssetUrl(data.url, hosts);
      const expiresAt = startedAt + data.expiresInSeconds * 1000;
      if (!controller.signal.aborted && expiresAt > Date.now())
        setAccess({ path, url, expiresAt });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof ApiError && error.status === 404
            ? "No accessible document was found. It may not be attached, or you may no longer have access."
            : error instanceof ApiError
              ? error.message
              : "The document access link could not be verified. Contact an administrator.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="detail-section">
      <h3>Private document</h3>
      <p>
        Request temporary access to the {label}. Availability and your permission are
        checked each time.
      </p>
      {!hosts.length && (
        <p className="notice">
          Document storage is not configured. Contact an administrator to enable
          downloads.
        </p>
      )}
      <Feedback message={error} />
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || busy || !hosts.length}
          onClick={() => void requestAccess()}
        >
          {busy ? "Checking document access…" : `Request ${label}`}
        </button>
        {currentAccess && !disabled && (
          <a
            className="button"
            href={currentAccess.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (Date.now() >= currentAccess.expiresAt) {
                event.preventDefault();
                setAccess(undefined);
              }
            }}
          >
            Download {label}
          </a>
        )}
      </div>
      {currentAccess && (
        <p role="status">
          Temporary access is ready. The download opens in a new tab; request access again
          if the link expires.
        </p>
      )}
    </div>
  );
}
