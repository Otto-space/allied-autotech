"use client";
import { useEffect, useState } from "react";
import { catalogueSchema, type LearningCatalogue } from "./contracts";
import { clearLearningProgress } from "./progress";

export const LEARNING_SESSION_CHANGED = "aat:session-changed";
export class LearningReadError extends Error {
  constructor(readonly status: number) {
    super("Learning information is unavailable. Your live work has not changed.");
  }
}
// Deliberately independent of the operational API client: GET only, no write token.
export async function readLearning(
  kind: "catalogue" | "articles" | "guides" | "scenarios",
  id: string | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  if (id !== undefined && !/^[a-z][a-z0-9-]{0,63}$/.test(id))
    throw new LearningReadError(404);
  const suffix = kind + (id ? "/" + encodeURIComponent(id) : "");
  for (const prefix of ["/learning/", "/public/learning/"]) {
    const response = await fetch("/api/v1" + prefix + suffix, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if ((response.status === 401 || response.status === 403) && prefix === "/learning/")
      continue;
    if (!response.ok) throw new LearningReadError(response.status);
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("data" in body) ||
      !("success" in body) ||
      body.success !== true
    )
      throw new LearningReadError(502);
    return body.data;
  }
  throw new LearningReadError(404);
}
export function useLearningCatalogue(active = true) {
  const [state, setState] = useState<{
    data: LearningCatalogue | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true,
      pending: AbortController | undefined,
      generation = 0;
    async function load() {
      const current = ++generation;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      // Hide all previously authorised content while access is being revalidated.
      setState((previous) => ({ ...previous, error: "", loading: true }));
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const data = catalogueSchema.parse(
          await readLearning("catalogue", undefined, controller.signal),
        );
        if (alive && current === generation)
          setState({ data, error: "", loading: false });
      } catch (error) {
        if (alive && current === generation)
          setState({
            data: null,
            error:
              error instanceof LearningReadError && error.status === 404
                ? "Help & Learn is not enabled for this release. The Help Centre remains available."
                : "Learning information could not be verified. Retry, or use the Help Centre. Your live work has not changed.",
            loading: false,
          });
      } finally {
        clearTimeout(timeout);
      }
    }
    function changed() {
      clearLearningProgress();
      setState({ data: null, error: "", loading: true });
      void load();
    }
    function visible() {
      if (document.visibilityState === "visible") void load();
    }
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    window.addEventListener(LEARNING_SESSION_CHANGED, changed);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      generation++;
      pending?.abort();
      clearInterval(timer);
      window.removeEventListener(LEARNING_SESSION_CHANGED, changed);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [active, revision]);
  return { ...state, refresh: () => setRevision((v) => v + 1) };
}
