"use client";

export const DRAFT_IDENTITY_CHANGED = "aat:draft-identity";
export const DRAFT_SAVED = "aat:draft-submitted";
const PREFIX = "aat:form-draft:v1:";
let identity: string | null = null;
type Submission = { key: string; snapshot: string };
let submission: Submission | null = null;

export function draftIdentity() {
  return identity;
}

export function setDraftIdentity(value: string | null) {
  if (identity === value) return;
  identity = value;
  submission = null;
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(DRAFT_IDENTITY_CHANGED));
}

export function clearAccountDrafts() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by the browser. */
  }
  setDraftIdentity(null);
  submission = null;
}

export function draftKey(owner: string, path: string, form: string) {
  return `${PREFIX}${JSON.stringify([owner, path, form])}`;
}

export type DraftValue = string | boolean | string[];
export type DraftFields = Record<string, DraftValue>;
export function readDraft(key: string): DraftFields {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw.length > 200_000) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([name, field]) =>
          name !== "__proto__" &&
          name !== "constructor" &&
          (typeof field === "string" ||
            typeof field === "boolean" ||
            (Array.isArray(field) && field.every((item) => typeof item === "string"))),
      ),
    );
  } catch {
    return {};
  }
}

export function writeDraft(key: string, fields: DraftFields) {
  try {
    const serialized = JSON.stringify(fields);
    if (serialized.length > 200_000) return false;
    sessionStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function forgetDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Optional browser storage. */
  }
  if (submission?.key === key) submission = null;
}

export function beginDraftSubmission(key: string) {
  try {
    const snapshot = sessionStorage.getItem(key);
    submission = snapshot ? { key, snapshot } : null;
  } catch {
    submission = null;
  }
}

export function cancelDraftSubmission() {
  submission = null;
}

// Capture before awaiting CSRF/network work. Later edits must not be erased by
// an earlier request, and upload preparation is not a completed form submission.
export function captureDraftSubmission(path: string, method: string) {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(method) ||
    path === "/auth/csrf" ||
    /(?:upload|presign|prepare|ticket)/i.test(path)
  )
    return null;
  return submission;
}

export function completeDraftSubmission(candidate: Submission | null) {
  if (!candidate || typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(candidate.key) !== candidate.snapshot) return;
    forgetDraft(candidate.key);
    window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: candidate.key }));
  } catch {
    /* A successful server save must not depend on browser storage. */
  }
}
