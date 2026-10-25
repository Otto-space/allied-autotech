"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { DRAFT_SAVED, DRAFT_STORAGE_FAILED, setDraftIdentity } from "@/lib/forms/drafts";
import { catalogueOnly } from "@/lib/public-launch";
import type { CatalogueEnquiryContext } from "@/lib/catalogue-enquiry";
import {
  chooseEnquiryContext,
  hasEnquiryDraft,
  prepareEnquiryContext,
  saveEnquiryDraftState,
} from "@/lib/forms/catalogue-enquiry-drafts";

const sessionSchema = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
  mfaRequired: z.boolean(),
  mfaVerifiedAt: z.string().nullable(),
});
export function CatalogueEnquiryDrafts({
  incoming,
  children,
}: {
  incoming: CatalogueEnquiryContext;
  children: (context: CatalogueEnquiryContext) => ReactNode;
}) {
  if (catalogueOnly()) return children(incoming);
  return <VerifiedDraftScope incoming={incoming}>{children}</VerifiedDraftScope>;
}
function VerifiedDraftScope({
  incoming,
  children,
}: {
  incoming: CatalogueEnquiryContext;
  children: (context: CatalogueEnquiryContext) => ReactNode;
}) {
  const [owner, setOwner] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void apiRequest("/auth/session", { optionalSession: true, signal: controller.signal })
      .then((response) => {
        const value = sessionSchema.parse(response.data);
        if (value.mfaRequired && !value.mfaVerifiedAt) throw Error("Unverified identity");
        if (active) {
          const principal = `${value.user.id}:${value.user.role}`;
          setDraftIdentity(principal);
          setOwner(principal);
          setError(false);
        }
      })
      .catch((failure) => {
        if (!active || controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) {
          setDraftIdentity(null);
          setOwner("guest");
          setError(false);
        } else setError(true);
      });
    const changed = () => {
      setOwner(null);
      setError(false);
      setRevision((v) => v + 1);
    };
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [revision]);
  if (!owner)
    return error ? (
      <div role="status" className="notice">
        <p>
          We could not verify which saved drafts belong to this session. Your saved work
          has not been opened or changed.
        </p>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setError(false);
            setRevision((v) => v + 1);
          }}
        >
          Retry draft check
        </button>
      </div>
    ) : (
      <p role="status">Preparing your enquiry and checking saved drafts…</p>
    );
  return (
    <DraftChoices key={owner} owner={owner} incoming={incoming}>
      {children}
    </DraftChoices>
  );
}
function DraftChoices({
  owner,
  incoming,
  children,
}: {
  owner: string;
  incoming: CatalogueEnquiryContext;
  children: (context: CatalogueEnquiryContext) => ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ReturnType<
    typeof prepareEnquiryContext
  > | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [binding, setBinding] = useState("");
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(new Set<string>());
  const latestSnapshot = useRef(snapshot);
  const storageFault = useRef(false);
  useEffect(() => {
    latestSnapshot.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    let next = prepareEnquiryContext(owner, incoming);
    const previous = latestSnapshot.current;
    if (
      previous &&
      previous.selected.id !== incoming.id &&
      next.selected.id !== previous.selected.id &&
      dirty.current.has(previous.selected.id)
    ) {
      const contexts = next.state.contexts.some((c) => c.id === previous.selected.id)
        ? next.state.contexts
        : [...next.state.contexts, previous.selected];
      next = {
        ...next,
        state: { ...next.state, contexts },
        selected: previous.selected,
        conflict: true,
      };
    }
    setSnapshot(next);
    setBinding(incoming.id);
    setStorageAvailable(
      saveEnquiryDraftState(owner, next.state) && !storageFault.current,
    );
  }, [owner, incoming]);
  const [, refresh] = useState(0);
  useEffect(() => {
    const saved = () => {
      dirty.current.clear();
      refresh((v) => v + 1);
    };
    const failed = () => {
      storageFault.current = true;
      setStorageAvailable(false);
    };
    window.addEventListener(DRAFT_SAVED, saved);
    window.addEventListener(DRAFT_STORAGE_FAILED, failed);
    return () => {
      window.removeEventListener(DRAFT_SAVED, saved);
      window.removeEventListener(DRAFT_STORAGE_FAILED, failed);
    };
  }, []);
  if (!snapshot) return <p role="status">Checking enquiry drafts…</p>;
  const checking = binding !== incoming.id;
  function choose(id: string) {
    if (!snapshot) return;
    const state = chooseEnquiryContext(snapshot.state, incoming.id, id);
    const context = state.contexts.find((c) => c.id === id);
    if (!context) return;
    const saved = saveEnquiryDraftState(owner, state);
    setStorageAvailable(saved && !storageFault.current);
    setSnapshot({ ...snapshot, state, selected: context, conflict: false });
    requestAnimationFrame(() => selectedHeading.current?.focus({ preventScroll: true }));
  }
  const previous = snapshot.state.contexts.filter(
    (c) => c.id !== snapshot.selected.id && hasEnquiryDraft(owner, c),
  );
  const pending =
    snapshot.selected.id !== snapshot.incoming.id ? snapshot.incoming : null;
  return (
    <section
      className="catalogue-enquiry-drafts"
      aria-label="Your enquiry drafts"
      onInputCapture={() => dirty.current.add(snapshot.selected.id)}
      onChangeCapture={() => dirty.current.add(snapshot.selected.id)}
    >
      {checking && <p role="status">Checking enquiry drafts…</p>}
      {!storageAvailable && (
        <p className="notice" role="status">
          Browser draft storage is unavailable. Keep this page open and copy your message
          before leaving; drafts cannot be guaranteed after a refresh.
        </p>
      )}
      {snapshot.conflict && (
        <section className="notice" aria-labelledby="enquiry-draft-choice">
          <h3 id="enquiry-draft-choice" tabIndex={-1}>
            You have an unsent enquiry
          </h3>
          <dl>
            <div>
              <dt>Current draft</dt>
              <dd>{snapshot.selected.label}</dd>
            </div>
            <div>
              <dt>Incoming enquiry</dt>
              <dd>{snapshot.incoming.label}</dd>
            </div>
          </dl>
          <p>
            Choose which one to open. Starting this enquiry keeps the previous draft
            separately; messages will not be merged.
          </p>
          <div className="actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => choose(snapshot.selected.id)}
            >
              Keep current draft
            </button>
            <button
              className="button"
              type="button"
              disabled={!storageAvailable}
              onClick={() => choose(snapshot.incoming.id)}
            >
              Start this enquiry
            </button>
          </div>
        </section>
      )}
      <div hidden={snapshot.conflict || checking} inert={snapshot.conflict || checking}>
        <h3 ref={selectedHeading} tabIndex={-1}>
          Your enquiry
        </h3>
        {pending && (
          <div className="notice">
            <p>Pending: {pending.label}. Your current draft is unchanged.</p>
            <button
              className="text-link"
              type="button"
              disabled={!storageAvailable}
              onClick={() => choose(pending.id)}
            >
              Start pending enquiry
            </button>
          </div>
        )}
        {children(snapshot.selected)}
        {previous.length > 0 && (
          <aside className="notice" aria-label="Preserved enquiry drafts">
            <h4>Resume another draft</h4>
            <ul>
              {previous.map((context) => (
                <li key={context.id}>
                  <button
                    className="text-link"
                    type="button"
                    disabled={!storageAvailable}
                    onClick={() => choose(context.id)}
                  >
                    Resume {context.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}
