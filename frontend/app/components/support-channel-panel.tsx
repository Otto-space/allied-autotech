"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { WORKFORCE_ACCESS_CHANGED } from "@/lib/workforce-invalidation";
import {
  assertChannelTarget,
  careChannelCandidatesSchema,
  careChannelLookupSchema,
  careChannelOutcomeSchema,
  careChannelSavedSchema,
  type CareChannel,
} from "@/lib/api/support-channel-schemas";
import {
  channelRecoveryOwner,
  clearChannelPending,
  newChannelOperationKey,
  readChannelPending,
  saveChannelPending,
  type ChannelPending,
} from "@/lib/support/channel-pending";
import type { SupportKind } from "@/lib/api/support-schemas";
import { useAccountSession } from "./dashboard-shell";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import styles from "./support-channel-panel.module.css";

type Props = {
  userId: string;
  kind: SupportKind;
  id: string;
  staff?: boolean;
  disabled?: boolean;
  closed?: boolean;
  hasBranch?: boolean;
  onCaseChanged: () => void;
  onPublicUpdate?: (id: string) => void;
};
export function SupportChannelPanel(props: Props) {
  const session = useAccountSession();
  if (!session || session.user.id !== props.userId) return null;
  return (
    <ChannelControls
      key={`${session.id}:${session.user.id}:${session.user.role}:${props.kind}:${props.id}`}
      {...props}
      role={session.user.role}
    />
  );
}
function ChannelControls({
  userId,
  role,
  kind,
  id,
  staff = false,
  disabled = false,
  closed = false,
  hasBranch = true,
  onCaseChanged,
  onPublicUpdate,
}: Props & { role: string }) {
  const root = staff
    ? "/staff/workforce/support-chat/channels"
    : "/customers/support/live/channels";
  const target = {
    kind: kind === "enquiries" ? ("ENQUIRY" as const) : ("COMPLAINT" as const),
    id,
  };
  const parse = useCallback(
    (value: unknown) => {
      const data = careChannelLookupSchema.parse(value);
      if (data.channel) assertChannelTarget(data.channel, kind, id);
      return data;
    },
    [kind, id],
  );
  const resource = useResource(`${root}/by-case/${target.kind}/${id}`, parse);
  const { revalidate, error: statusError, refreshError: statusRefreshError } = resource;
  const [owner, setOwner] = useState<string>(),
    [ready, setReady] = useState(false);
  const [pending, setPending] = useState<ChannelPending | null>(null),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>(),
    [storageError, setStorageError] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [choosing, setChoosing] = useState(false),
    [reason, setReason] = useState(""),
    [assignee, setAssignee] = useState("");
  const [candidateCursor, setCandidateCursor] = useState<string>();
  const running = useRef(false),
    alive = useRef(false),
    generation = useRef(0);
  const recoveryButton = useRef<HTMLButtonElement>(null),
    focusRecovery = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null),
    focusResult = useRef(false);
  const previous = useRef<{
    caseVersion: number;
    latestPublicMessageId: string | null;
  } | null>(null);
  const callbacks = useRef({ onCaseChanged, onPublicUpdate });
  const proposalOpen = useRef(false),
    paused = useRef(false);
  const channel = resource.error || resource.refreshError ? null : resource.data?.channel;
  const fresh =
    !resource.loading &&
    !resource.refreshing &&
    !resource.error &&
    !resource.refreshError &&
    !!resource.data;
  const blocked =
    disabled || !ready || !!storageError || !!pending || busy || !!proposal || !fresh;
  const candidates = useResource(
    choosing && channel?.canTransfer
      ? `${root}/${channel.id}/assignees?limit=10${candidateCursor ? `&cursor=${candidateCursor}` : ""}`
      : null,
    careChannelCandidatesSchema.parse,
  );
  useEffect(() => {
    callbacks.current = { onCaseChanged, onPublicUpdate };
  }, [onCaseChanged, onPublicUpdate]);
  useEffect(() => {
    proposalOpen.current = !!proposal;
    paused.current = resource.denied || resource.loading || resource.refreshing;
  }, [proposal, resource.denied, resource.loading, resource.refreshing]);
  useEffect(() => {
    if (!proposal && pending && !busy && focusRecovery.current) {
      focusRecovery.current = false;
      recoveryButton.current?.focus();
    } else if (!proposal && !busy && focusResult.current) {
      focusResult.current = false;
      resultHeading.current?.focus({ preventScroll: true });
    }
  }, [proposal, pending, busy]);
  useEffect(() => {
    alive.current = true;
    let current = true;
    const advanceGeneration = () => {
      generation.current++;
    };
    void channelRecoveryOwner(userId, role, kind, id)
      .then((key) => {
        if (!current) return;
        setOwner(key);
        try {
          setPending(readChannelPending(key));
          setReady(true);
        } catch {
          setStorageError(
            "The saved action reminder could not be read. Check your case history, then sign out and back in before starting another conversation action.",
          );
        }
      })
      .catch(() => {
        if (current)
          setStorageError(
            "Recovery storage is unavailable. Continue using the ordinary message form.",
          );
      });
    const invalidate = () => {
      advanceGeneration();
      previous.current = null;
      setProposal(null);
      setChoosing(false);
      setReason("");
      setAssignee("");
    };
    window.addEventListener(SESSION_CHANGED, invalidate);
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, invalidate);
    return () => {
      current = false;
      alive.current = false;
      advanceGeneration();
      window.removeEventListener(SESSION_CHANGED, invalidate);
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, invalidate);
    };
  }, [userId, role, kind, id]);
  useEffect(() => {
    const data = resource.data;
    if (!data || resource.error || resource.refreshError) return;
    const old = previous.current;
    previous.current = data;
    if (old && old.caseVersion !== data.caseVersion) callbacks.current.onCaseChanged();
    if (
      old &&
      data.latestPublicMessageId &&
      old.latestPublicMessageId !== data.latestPublicMessageId
    )
      callbacks.current.onPublicUpdate?.(data.latestPublicMessageId);
  }, [resource.data, resource.error, resource.refreshError]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      if (
        !paused.current &&
        !running.current &&
        !proposalOpen.current &&
        document.visibilityState === "visible" &&
        navigator.onLine
      )
        revalidate();
      timer = setTimeout(poll, statusError || statusRefreshError ? 15000 : 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => clearTimeout(timer);
  }, [revalidate, statusError, statusRefreshError]);

  function forgetMarker() {
    if (!owner) throw new Error("Recovery storage is not ready.");
    clearChannelPending(owner);
    setPending(null);
  }
  function checkChannel(value: CareChannel) {
    return assertChannelTarget(value, kind, id);
  }
  function updated() {
    resource.refresh();
    callbacks.current.onCaseChanged();
  }
  async function send(
    action: ChannelPending["action"],
    body: object,
    minimumVersion: number,
    operationKey: string,
    channelId?: string,
  ) {
    if (!owner || running.current || pending || disabled)
      throw new Error("Check the pending action before continuing.");
    const marker = { action, operationKey };
    saveChannelPending(owner, marker);
    setPending(marker);
    const epoch = generation.current;
    running.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await apiRequest<unknown>(
        action === "request" ? root : `${root}/${channelId}/actions`,
        { method: "POST", csrf: true, idempotencyKey: operationKey, body },
      );
      if (!alive.current || epoch !== generation.current)
        throw new DOMException("Access changed", "AbortError");
      const result = checkChannel(careChannelSavedSchema.parse(response.data));
      if (result.version < minimumVersion)
        throw new Error("An older action result was returned.");
      forgetMarker();
      focusResult.current = true;
      setChoosing(false);
      setReason("");
      setAssignee("");
      updated();
    } catch (error) {
      if (alive.current && epoch === generation.current) {
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          ![408, 429].includes(error.status)
        ) {
          forgetMarker();
          resource.refresh();
        } else {
          focusRecovery.current = true;
          setMessage(
            "The action may have saved. Check its outcome before trying another action.",
          );
        }
      }
      throw error;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function review(action: ChannelPending["action"]) {
    if (blocked || !resource.data) return;
    const operationKey = newChannelOperationKey(),
      version = channel?.version ?? 0;
    const body =
      action === "request"
        ? {
            target,
            expectedCaseVersion: resource.data.caseVersion,
            expectedChannelVersion: version,
          }
        : action === "transfer"
          ? {
              action,
              expectedVersion: version,
              targetStaffId: assignee,
              reason: reason.trim(),
            }
          : { action, expectedVersion: version };
    const selected = candidates.data?.items.find((person) => person.staffId === assignee);
    if (action === "transfer" && (!selected || reason.trim().length < 5)) {
      setMessage(
        "Choose an available representative and enter a reason of at least five characters.",
      );
      return;
    }
    setMessage(undefined);
    setProposal({
      title:
        action === "request"
          ? "Request a Care conversation?"
          : action === "claim"
            ? "Join this conversation?"
            : action === "transfer"
              ? "Transfer this conversation?"
              : "End this conversation?",
      description:
        action === "request"
          ? "Your request is saved in this case. If a representative cannot join, you can continue leaving messages here."
          : action === "claim"
            ? "The customer will see that a Customer Care representative has joined."
            : action === "transfer"
              ? "The customer sees a transfer update. Your reason is recorded only in staff audit history."
              : "The conversation ends. The case stays available for ordinary follow-up.",
      facts: [
        { label: "Case", value: id },
        { label: "Audience", value: "Customer-visible system update" },
        ...(selected && action === "transfer"
          ? [
              { label: "Representative", value: selected.name },
              { label: "Internal audit reason", value: reason.trim() },
            ]
          : []),
      ],
      submit: () => send(action, body, version + 1, operationKey, channel?.id),
      retryAfterRejection: false,
      onUncertain: () => {
        focusRecovery.current = true;
        setProposal(null);
      },
    });
  }
  async function recover(cancel = false) {
    if (!pending || !owner || running.current) return;
    const marker = pending,
      epoch = generation.current;
    running.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await apiRequest<unknown>(
        `${root}/operations/${marker.action}/${marker.operationKey}`,
        cancel ? { method: "DELETE", csrf: true, body: { target } } : {},
      );
      if (!alive.current || epoch !== generation.current) return;
      const result = careChannelOutcomeSchema.parse(response.data);
      if (result.action !== marker.action)
        throw new Error("The saved outcome does not match the pending action.");
      if (result.channel) checkChannel(result.channel);
      forgetMarker();
      focusResult.current = true;
      setProposal(null);
      updated();
      setMessage(
        result.state === "SAVED"
          ? "The original action was saved. Current case state has been refreshed."
          : "The unsaved action was stopped. Your case and message history are preserved.",
      );
    } catch (error) {
      if (alive.current && epoch === generation.current) {
        if (error instanceof ApiError && error.code === "IDEMPOTENCY_EXPIRED") {
          setProposal(null);
          setMessage(
            "This action's timestamp is outside the server recovery window. Keep this reminder and check your case history. Sign out and back in before starting another action if recovery stays unavailable.",
          );
        } else
          setMessage(
            error instanceof ApiError && error.status === 404
              ? "No saved outcome was found. A submission may still be pending; check again or review stopping the unsaved action."
              : "The outcome could not be verified. Keep this reminder and try again when your connection and access are available.",
          );
      }
      if (cancel) throw error;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const status =
    resource.error || resource.refreshError
      ? "Updates paused"
      : resource.loading
        ? "Checking status"
        : channel?.state === "HUMAN_ACTIVE"
          ? "Representative joined"
          : channel?.state === "QUEUED"
            ? "Queued"
            : channel?.state === "ENDED"
              ? "Ended"
              : "Messages in this case";
  return (
    <section
      className={styles.panel}
      aria-labelledby={`care-channel-${id}`}
      aria-busy={busy || resource.refreshing}
    >
      <div className={styles.heading}>
        <h2 ref={resultHeading} tabIndex={-1} id={`care-channel-${id}`}>
          Customer Care conversation
        </h2>
        <span className={styles.status}>{status}</span>
      </div>
      <p>
        {channel?.state === "HUMAN_ACTIVE" && !resource.error && !resource.refreshError
          ? "Use the message form below to continue. Messages refresh while this page is open; a saved message is not a read receipt."
          : "Your messages stay in this case. Availability and conversation status are checked while this page is open."}
      </p>
      {!hasBranch && (
        <p>
          Conversation routing is not set up for this case. Continue using the ordinary
          message form while Customer Care assigns a branch.
        </p>
      )}
      {(resource.error || resource.refreshError) && (
        <p role="status">
          Current status could not be checked. Your ordinary Care history and message form
          remain available.
        </p>
      )}
      <Feedback
        message={storageError ?? message}
        tone={
          message?.startsWith("The original") || message?.startsWith("The unsaved")
            ? "success"
            : "error"
        }
      />
      {pending && !busy && (
        <div className={styles.recovery} role="status">
          <strong>An earlier action needs checking</strong>
          <p>Check whether it saved before starting another conversation action.</p>
          <div className={styles.actions}>
            <button
              ref={recoveryButton}
              className="button secondary"
              onClick={() => void recover()}
              disabled={busy}
            >
              Check saved action
            </button>
            <button
              className="button secondary"
              disabled={busy || disabled}
              onClick={() =>
                setProposal({
                  title: "Stop the unsaved action?",
                  description:
                    "A saved action is preserved and shown. If it has not saved, stopping it prevents a delayed original request from applying.",
                  facts: [{ label: "Case", value: id }],
                  submit: () => recover(true),
                  retryAfterRejection: false,
                })
              }
            >
              Review stopping action
            </button>
          </div>
        </div>
      )}
      <div className={styles.actions}>
        {!staff && hasBranch && !closed && (!channel || channel.state === "ENDED") && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={() => review("request")}
          >
            Request a conversation
          </button>
        )}
        {staff && channel?.canClaim && (
          <button
            className="button primary"
            disabled={blocked}
            onClick={() => review("claim")}
          >
            Join conversation
          </button>
        )}
        {staff && channel?.canTransfer && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={() => setChoosing((value) => !value)}
          >
            Transfer
          </button>
        )}
        {channel?.canEnd && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={() => review("end")}
          >
            End conversation
          </button>
        )}
        <button
          className="button secondary"
          disabled={busy || resource.loading || resource.refreshing}
          onClick={resource.refresh}
        >
          Refresh status
        </button>
        {staff && !channel?.canClaim && channel?.state === "QUEUED" && (
          <Link href="/admin/support">Check Care availability</Link>
        )}
      </div>
      {choosing && channel?.canTransfer && (
        <div className={styles.transfer}>
          <label>
            Available representative
            <select
              value={assignee}
              disabled={
                busy ||
                candidates.loading ||
                !!candidates.error ||
                !!candidates.refreshError
              }
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Choose a representative</option>
              {candidates.data?.items.map((person) => (
                <option key={person.staffId} value={person.staffId}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          {candidates.loading && <p role="status">Checking current availability…</p>}
          {(candidates.error || candidates.refreshError) && (
            <p role="alert">
              Candidates could not be checked.{" "}
              <button className="text-link" onClick={candidates.refresh}>
                Retry candidates
              </button>
            </p>
          )}
          {candidates.data?.items.length === 0 && !candidates.loading && (
            <p>No eligible representative is available on this page.</p>
          )}
          {candidates.data?.nextCursor && (
            <button
              className="button secondary"
              onClick={() => {
                setAssignee("");
                setCandidateCursor(candidates.data!.nextCursor);
              }}
            >
              More representatives
            </button>
          )}
          {candidateCursor && (
            <button
              className="button secondary"
              onClick={() => {
                setAssignee("");
                setCandidateCursor(undefined);
              }}
            >
              First candidate page
            </button>
          )}
          <label>
            Reason · staff audit only
            <textarea
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="button secondary"
            disabled={
              blocked ||
              !assignee ||
              reason.trim().length < 5 ||
              candidates.loading ||
              !!candidates.error ||
              !!candidates.refreshError
            }
            onClick={() => review("transfer")}
          >
            Review transfer
          </button>
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm"
          onClose={() => setProposal(null)}
          onSuccess={() => undefined}
        />
      )}
    </section>
  );
}
