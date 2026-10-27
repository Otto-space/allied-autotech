"use client";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api/client";
import type { LearningCatalogue } from "@/lib/learning/contracts";
import {
  createConversationClient,
  type AllieConversation,
} from "@/lib/learning/conversation";
import {
  handoffBody,
  handoffDraftSchema,
  handoffHref,
  handoffRecoverySchema,
  handoffCancelledSchema,
  parseHandoffPreview,
  parseHandoffSaved,
  type HandoffDraft,
  type HandoffPreview,
  type HandoffSaved,
} from "@/lib/learning/handoff";
import {
  readHandoffPending,
  saveHandoffPending,
  clearHandoffPending,
  newHandoffKey,
} from "@/lib/learning/handoff-pending";
import { HandoffDestination, type HandoffChoice } from "./handoff-destination";

type Editor = {
  subject: string;
  summary: string;
  kind: "NEW_ENQUIRY" | "ENQUIRY" | "COMPLAINT";
  branch: HandoffChoice | null;
  target: HandoffChoice | null;
  selections: NonNullable<HandoffDraft["excerpts"]>["selections"];
  conversationId: string | null;
};
export type HandoffMemory = { owner: string; at: number; editor: Editor } | null;
const path = "/customers/support/handoff";

export function AllieHandoff({
  data,
  conversation,
  memory,
  onMemoryChange,
  onReturn,
  onNavigate,
  onSaved,
}: {
  data: LearningCatalogue;
  conversation: AllieConversation | null;
  memory: HandoffMemory;
  onMemoryChange: (value: HandoffMemory) => void;
  onReturn: () => void;
  onNavigate: () => void;
  onSaved: (conversationId: string | null) => void;
}) {
  const uid = useId(),
    heading = useRef<HTMLHeadingElement>(null),
    alive = useRef(false),
    request = useRef<AbortController | null>(null);
  const [editor, setEditor] = useState<Editor>(() =>
    memory?.owner === data.accessKey && Date.now() - memory.at < 900000
      ? memory.editor
      : {
          subject: "",
          summary: conversation?.messages.at(-1)?.question ?? "",
          kind: "NEW_ENQUIRY",
          branch: null,
          target: null,
          selections: [],
          conversationId: conversation?.id ?? null,
        },
  );
  const [busy, setBusy] = useState("Checking handoff recovery…"),
    [error, setError] = useState("");
  const [operationKey, setOperationKey] = useState<string | null>(null);
  const [review, setReview] = useState<{
    draft: HandoffDraft;
    preview: HandoffPreview;
  } | null>(null);
  const [saved, setSaved] = useState<HandoffSaved | null>(null);
  const [uncertain, setUncertain] = useState(false),
    [notice, setNotice] = useState("");
  const [recoveredContext, setRecoveredContext] = useState<AllieConversation | null>(
    null,
  );
  const [expired, setExpired] = useState(false);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const client = useMemo(() => createConversationClient(data), [data]);
  const source =
    conversation?.audience === "customer" &&
    (!editor.conversationId || conversation.id === editor.conversationId)
      ? conversation
      : recoveredContext;
  const locked = !!busy || !!operationKey || !!saved || recoveryBlocked;
  useEffect(() => {
    onMemoryChange(saved ? null : { owner: data.accessKey, at: Date.now(), editor });
  }, [editor, saved, onMemoryChange, data.accessKey]);
  async function work(label: string, task: (signal: AbortSignal) => Promise<void>) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(label);
    setError("");
    try {
      await task(controller.signal);
    } catch {
      if (alive.current && !controller.signal.aborted) {
        setUncertain(true);
        setError(
          "The result could not be verified. Check or cancel this operation before starting another. Your editable summary is retained.",
        );
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (alive.current) setBusy("");
    }
  }
  function markerCleared() {
    try {
      clearHandoffPending(data.accessKey);
    } catch {
      setNotice(
        "The saved result is verified, but your browser kept its recovery marker. Reopening help will check it safely.",
      );
    }
  }
  function acceptSaved(
    value: unknown,
    expected?: HandoffPreview,
    endedId?: string | null,
  ) {
    const result = parseHandoffSaved(value, expected);
    setSaved(result);
    setReview(null);
    setUncertain(false);
    setOperationKey(null);
    markerCleared();
    onMemoryChange(null);
    onSaved(endedId ?? null);
    setTimeout(() => heading.current?.focus(), 0);
  }
  function restoreEditor(draft: HandoffDraft, preview?: HandoffPreview) {
    setEditor((prior) => ({
      ...prior,
      subject: draft.target.kind === "NEW_ENQUIRY" ? draft.target.subject : prior.subject,
      summary: draft.summary,
      kind: draft.target.kind,
      branch:
        draft.target.kind === "NEW_ENQUIRY" && draft.target.branchId
          ? {
              id: draft.target.branchId,
              label:
                preview?.target.branchName ??
                prior.branch?.label ??
                "Previously selected branch",
              version: 0,
              branchId: draft.target.branchId,
            }
          : prior.branch,
      target:
        draft.target.kind !== "NEW_ENQUIRY"
          ? {
              id: draft.target.id,
              label:
                preview?.target.subject ??
                prior.target?.label ??
                "Previously selected request",
              version: draft.target.expectedVersion,
              branchId: preview?.target.branchId ?? prior.target?.branchId ?? null,
            }
          : prior.target,
      selections: draft.excerpts?.selections ?? [],
      conversationId: draft.excerpts?.conversationId ?? prior.conversationId,
    }));
  }
  async function inspect(key: string, signal: AbortSignal) {
    const response = await apiRequest(path + "/drafts/" + key, { signal });
    signal.throwIfAborted();
    const result = handoffRecoverySchema.parse(response.data);
    if (result.state === "SAVED") {
      acceptSaved(result);
      return;
    }
    if (result.state === "CANCELLED") {
      markerCleared();
      setOperationKey(null);
      setReview(null);
      setUncertain(false);
      setNotice(
        "The earlier operation was cancelled. You can edit and review your draft.",
      );
      return;
    }
    restoreEditor(result.draft, result.preview ?? undefined);
    if (result.state === "NEEDS_REVIEW") {
      setReview(null);
      setUncertain(true);
      setNotice(
        "The earlier review or context changed. Cancel the old operation, then edit and review again. Stale help excerpts were removed.",
      );
      return;
    }
    let context = source;
    if (result.draft.excerpts) {
      context = await client.read(result.draft.excerpts.conversationId, signal);
      signal.throwIfAborted();
      setRecoveredContext(context);
    }
    const preview = parseHandoffPreview(result.preview, result.draft, context);
    setReview({ draft: result.draft, preview });
    setUncertain(false);
    setNotice("Your exact review was recovered. Nothing is sent until you confirm.");
  }
  const initialize = useEffectEvent(
    () =>
      void work("Checking handoff recovery…", async (signal) => {
        let pending: string | null;
        try {
          pending = readHandoffPending(data.accessKey);
        } catch {
          setRecoveryBlocked(true);
          setError(
            "Your browser's recovery marker could not be read. To avoid a duplicate request, check your Customer Care history and restore session storage before starting another handoff.",
          );
          return;
        }
        if (pending) {
          setOperationKey(pending);
          await inspect(pending, signal);
        } else if (editor.conversationId && !source) {
          try {
            const context = await client.read(editor.conversationId, signal);
            signal.throwIfAborted();
            setRecoveredContext(context);
          } catch {
            if (!signal.aborted)
              setNotice(
                "Earlier help could not be revalidated. You can remove its selection and prepare your own summary.",
              );
          }
        }
      }),
  );
  useEffect(() => {
    alive.current = true;
    const start = setTimeout(initialize, 0);
    return () => {
      alive.current = false;
      clearTimeout(start);
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!review) return;
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(review.preview.review.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [review]);
  function prepare() {
    if (locked || request.current) return;
    let draft: HandoffDraft;
    try {
      if (editor.kind !== "NEW_ENQUIRY" && !editor.target)
        throw new Error("Choose a request");
      draft = handoffDraftSchema.parse({
        target:
          editor.kind === "NEW_ENQUIRY"
            ? {
                kind: editor.kind,
                subject: editor.subject,
                ...(editor.branch ? { branchId: editor.branch.id } : {}),
              }
            : {
                kind: editor.kind,
                id: editor.target!.id,
                expectedVersion: editor.target!.version,
              },
        summary: editor.summary,
        ...(editor.selections.length
          ? {
              excerpts: {
                conversationId: source?.id,
                expectedVersion: source?.version,
                selections: editor.selections,
              },
            }
          : {}),
      });
      if (handoffBody(draft, source).length > 4000) throw new Error("Too long");
    } catch {
      setError(
        "Enter a subject and summary, choose any existing request, and review your help selection. Keep the complete message within 4,000 characters.",
      );
      return;
    }
    const key = newHandoffKey();
    try {
      saveHandoffPending(data.accessKey, key);
    } catch {
      setError(
        "Your browser could not save the operation ID. Allow session storage before reviewing, or use your existing Customer Care page. Your summary has not been sent.",
      );
      return;
    }
    setOperationKey(key);
    void work("Preparing your exact review…", async (signal) => {
      const response = await apiRequest(path + "/preview", {
        method: "POST",
        csrf: true,
        idempotencyKey: key,
        body: draft,
        signal,
      });
      signal.throwIfAborted();
      const preview = parseHandoffPreview(response.data, draft, source);
      if (
        draft.target.kind !== "NEW_ENQUIRY" &&
        editor.target?.branchId &&
        preview.target.branchId !== editor.target.branchId
      )
        throw new Error("Target changed");
      setReview({ draft, preview });
      setExpired(false);
      setUncertain(false);
      setNotice("");
      setTimeout(() => heading.current?.focus(), 0);
    });
  }
  function send() {
    if (!review || !operationKey || busy || expired) return;
    void work("Saving your Customer Care message…", async (signal) => {
      const response = await apiRequest(path, {
        method: "POST",
        csrf: true,
        idempotencyKey: operationKey,
        body: { draft: review.draft, review: review.preview.review, consent: true },
        signal,
      });
      signal.throwIfAborted();
      acceptSaved(response.data, review.preview, review.draft.excerpts?.conversationId);
    });
  }
  function cancel() {
    if (!operationKey || busy) return;
    void work("Checking and cancelling the old operation…", async (signal) => {
      const response = await apiRequest(path + "/drafts/" + operationKey, {
        method: "DELETE",
        csrf: true,
        signal,
      });
      signal.throwIfAborted();
      if (
        response.data &&
        typeof response.data === "object" &&
        "state" in response.data &&
        response.data.state === "SAVED"
      ) {
        acceptSaved(response.data, review?.preview);
        return;
      }
      handoffCancelledSchema.parse(response.data);
      markerCleared();
      setOperationKey(null);
      setReview(null);
      setUncertain(false);
      setExpired(false);
      setNotice("The old operation is cancelled. Your editable draft is retained.");
      setTimeout(() => heading.current?.focus(), 0);
    });
  }
  return (
    <section
      className="allie-handoff"
      aria-labelledby={uid + "-heading"}
      aria-busy={!!busy}
    >
      <h3 id={uid + "-heading"} ref={heading} tabIndex={-1}>
        {saved
          ? "Your message is saved"
          : review
            ? "Review your message"
            : "Leave a message for Customer Care"}
      </h3>
      <p>
        Messages are queued for our team. Read replies and follow up in your Customer Care
        history.
      </p>
      <p role="status">{busy || notice}</p>
      {error && <p role="alert">{error}</p>}
      {recoveryBlocked && (
        <Link href="/dashboard/support" onClick={onNavigate}>
          Check your Customer Care history
        </Link>
      )}
      {saved ? (
        <>
          <p>
            Saved to your {saved.reference.kind === "COMPLAINT" ? "complaint" : "enquiry"}
            . Saving does not confirm delivery or that a representative has read it.
          </p>
          <p className="handoff-reference">Reference: {saved.reference.id}</p>
          <Link
            className="button"
            href={handoffHref(saved)}
            prefetch={false}
            onClick={onNavigate}
          >
            Open your Customer Care conversation
          </Link>
        </>
      ) : review ? (
        <>
          <dl className="handoff-review-facts">
            <dt>Audience</dt>
            <dd>Customer Care · {review.preview.target.branchName}</dd>
            <dt>Destination</dt>
            <dd>
              {review.preview.target.kind === "NEW_ENQUIRY"
                ? "New enquiry"
                : "Your existing " + review.preview.target.kind.toLowerCase()}
              : {review.preview.target.subject}
            </dd>
          </dl>
          <div
            className="handoff-exact-message"
            aria-label="Exact message to Customer Care"
          >
            {review.preview.body}
          </div>
          <p>
            Confirming shares this exact message with Customer Care in your support
            conversation. Only your selected help excerpts are included.
          </p>
          {expired && (
            <p role="alert">
              This review expired. Check or cancel it before preparing a fresh review.
            </p>
          )}
          <div className="learning-actions">
            <button
              type="button"
              className="button"
              disabled={!!busy || expired}
              onClick={send}
            >
              {uncertain
                ? "Retry the same reviewed message"
                : "Send message to Customer Care"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={!!busy}
              onClick={cancel}
            >
              Go back and edit
            </button>
          </div>
        </>
      ) : (
        <form
          data-no-draft
          onSubmit={(e) => {
            e.preventDefault();
            prepare();
          }}
        >
          <fieldset disabled={locked}>
            <legend>Where should this message go?</legend>
            <label htmlFor={uid + "-destination"}>Support destination</label>
            <select
              id={uid + "-destination"}
              value={editor.kind}
              onChange={(e) =>
                setEditor((x) => ({
                  ...x,
                  kind: e.target.value as Editor["kind"],
                  target: null,
                }))
              }
            >
              <option value="NEW_ENQUIRY">Start a new enquiry</option>
              <option value="ENQUIRY">Add to one of my enquiries</option>
              <option value="COMPLAINT">Add to one of my complaints</option>
            </select>
            {editor.kind === "NEW_ENQUIRY" ? (
              <>
                <label htmlFor={uid + "-subject"}>Subject</label>
                <input
                  id={uid + "-subject"}
                  required
                  maxLength={160}
                  value={editor.subject}
                  onChange={(e) => setEditor((x) => ({ ...x, subject: e.target.value }))}
                />
                <HandoffDestination
                  kind="branches"
                  value={editor.branch}
                  disabled={locked}
                  onChange={(branch) => setEditor((x) => ({ ...x, branch }))}
                />
              </>
            ) : (
              <HandoffDestination
                key={editor.kind}
                kind={editor.kind === "ENQUIRY" ? "enquiries" : "complaints"}
                value={editor.target}
                disabled={locked}
                onChange={(target) => setEditor((x) => ({ ...x, target }))}
              />
            )}
          </fieldset>
          <label htmlFor={uid + "-summary"}>Your issue summary · editable</label>
          <textarea
            id={uid + "-summary"}
            rows={5}
            required
            maxLength={2000}
            value={editor.summary}
            readOnly={locked}
            onChange={(e) => setEditor((x) => ({ ...x, summary: e.target.value }))}
            aria-describedby={uid + "-privacy"}
          />
          <p id={uid + "-privacy"}>
            This summary goes to Customer Care after confirmation. It is not sent to the
            AI provider. Preparing a review keeps an encrypted recovery draft on our
            server for up to 15 minutes; the browser keeps only its operation ID.
          </p>
          <fieldset disabled={locked || !!source?.pending}>
            <legend>Optional help excerpts · choose up to two</legend>
            <p>No help transcript is attached automatically.</p>
            {source?.audience === "customer" &&
              source.messages.map((message) => (
                <div className="handoff-excerpt" key={message.operationId}>
                  {(["QUESTION", "ANSWER"] as const).map((part) => {
                    const checked = editor.selections.some(
                      (s) => s.operationId === message.operationId && s.part === part,
                    );
                    return (
                      <label key={part}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && editor.selections.length >= 2}
                          onChange={() =>
                            setEditor((x) => ({
                              ...x,
                              conversationId: source.id,
                              selections: checked
                                ? x.selections.filter(
                                    (s) =>
                                      s.operationId !== message.operationId ||
                                      s.part !== part,
                                  )
                                : [
                                    ...x.selections,
                                    { operationId: message.operationId, part },
                                  ],
                            }))
                          }
                        />
                        <span>
                          <strong>
                            {part === "QUESTION"
                              ? "Your help question"
                              : "Allie · AI-generated guidance"}
                          </strong>
                          <span>
                            {part === "QUESTION"
                              ? message.question
                              : [
                                  message.answer.answer,
                                  ...message.answer.steps,
                                  message.answer.caveat,
                                ]
                                  .filter(Boolean)
                                  .join("\n")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            {!source?.messages.length && (
              <p>
                No current help messages are available to select. You can send your own
                summary.
              </p>
            )}
            {source?.pending && (
              <p>
                An AI answer is pending. Excerpt selection is paused; your summary can
                still be reviewed.
              </p>
            )}
            {!!editor.selections.length && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditor((x) => ({ ...x, selections: [] }))}
              >
                Remove help selection
              </button>
            )}
          </fieldset>
          <button className="button" disabled={locked}>
            Review message
          </button>
        </form>
      )}
      {!saved && operationKey && (
        <div className="handoff-recovery">
          <p>
            Check the recorded outcome before starting a different operation. Cancellation
            preserves any message that already saved.
          </p>
          <div className="learning-actions">
            <button
              type="button"
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void work("Checking your handoff…", (signal) =>
                  inspect(operationKey, signal),
                )
              }
            >
              Check handoff
            </button>
            {!review && (
              <button
                type="button"
                className="button secondary"
                disabled={!!busy}
                onClick={cancel}
              >
                Cancel old operation and edit
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className="learning-text-button allie-back"
        disabled={!!busy}
        onClick={onReturn}
      >
        {saved ? "Back to help" : "Back to help · keep my draft"}
      </button>
    </section>
  );
}
