"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  careChannelQueueSchema,
  carePresenceSchema,
} from "@/lib/api/support-channel-schemas";
import { WORKFORCE_ACCESS_CHANGED } from "@/lib/workforce-invalidation";
import { formatBusinessDate } from "@/lib/format/date";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import { OwnerSupportCoverage } from "./support-coverage-editor";
import styles from "./support-channel-panel.module.css";

const presencePath = "/staff/workforce/support-chat/presence";
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(z.object({ id: z.uuid(), name: z.string() })) }).parse(value);

/** A channel view of existing Care cases, never a separate message inbox. */
export function SupportChannelWorkspace({
  kind,
  branchId,
  managed = false,
}: {
  kind: "enquiries" | "complaints";
  branchId?: string | null;
  managed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      id="care-conversation-workspace"
      className={styles.panel}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Conversation queue and your availability</summary>
      {open && (
        <ChannelWorkspace
          key={`${kind}:${branchId ?? "all"}`}
          kind={kind}
          branchId={branchId}
          managed={managed}
        />
      )}
    </details>
  );
}
function ChannelWorkspace({
  kind,
  branchId,
  managed,
}: {
  kind: "enquiries" | "complaints";
  branchId?: string | null;
  managed: boolean;
}) {
  const presence = useResource(presencePath, carePresenceSchema.parse);
  const branches = useResource("/public/branches", parseBranches);
  const [cursor, setCursor] = useState<string>(),
    [state, setState] = useState("ACTIVE");
  const queue = useResource(
    `/staff/workforce/support-chat/channels?limit=10&kind=${kind === "enquiries" ? "ENQUIRY" : "COMPLAINT"}&state=${state}${branchId ? `&branchId=${branchId}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    careChannelQueueSchema.parse,
  );
  const {
    revalidate: revalidatePresence,
    denied: presenceDenied,
    loading: presenceLoading,
    refreshing: presenceRefreshing,
  } = presence;
  const {
    revalidate: revalidateQueue,
    denied: queueDenied,
    loading: queueLoading,
    refreshing: queueRefreshing,
  } = queue;
  const [chosenBranch, setChosenBranch] = useState(""),
    [capacity, setCapacity] = useState(1);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [message, setMessage] = useState<string>();
  const [leasePaused, setLeasePaused] = useState(false),
    [unknown, setUnknown] = useState(false);
  const renewing = useRef(false),
    active = useRef(false),
    generation = useRef(0);
  const current = presence.data,
    fresh =
      !!current &&
      !presence.error &&
      !presence.refreshError &&
      !presence.loading &&
      !presence.refreshing;
  const selected =
    chosenBranch || current?.branchId || current?.eligibleBranches[0]?.branchId || "";
  const label = (id: string) =>
    branches.data?.items.find((branch) => branch.id === id)?.name ??
    `Branch ${id.slice(0, 8)}`;
  const heartbeatAllowed =
    !!current?.enabled &&
    !!current.optedIn &&
    !leasePaused &&
    !presence.error &&
    !presence.refreshError;
  const heartbeatVersion = current?.version;
  useEffect(() => {
    active.current = true;
    const advanceGeneration = () => {
      generation.current++;
    };
    const invalidate = () => {
      advanceGeneration();
      setProposal(null);
      setLeasePaused(true);
    };
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, invalidate);
    return () => {
      active.current = false;
      advanceGeneration();
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, invalidate);
    };
  }, []);
  useEffect(() => {
    if (!heartbeatAllowed || !heartbeatVersion) return;
    const renew = async () => {
      if (renewing.current || document.visibilityState !== "visible" || !navigator.onLine)
        return;
      const epoch = generation.current;
      renewing.current = true;
      try {
        carePresenceSchema.parse(
          (
            await apiRequest(presencePath + "/heartbeat", {
              method: "POST",
              csrf: true,
              body: { expectedVersion: heartbeatVersion },
            })
          ).data,
        );
      } catch {
        if (active.current && epoch === generation.current) {
          setLeasePaused(true);
          setMessage(
            "Your availability could not be renewed. It may expire. Refresh and explicitly review availability again; ordinary Care messages remain available.",
          );
          revalidatePresence();
        }
      } finally {
        renewing.current = false;
      }
    };
    const timer = setInterval(() => void renew(), 25000);
    return () => clearInterval(timer);
  }, [heartbeatAllowed, heartbeatVersion, revalidatePresence]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine || proposal) return;
      if (!queueDenied && !queueLoading && !queueRefreshing) revalidateQueue();
      if (!presenceDenied && !presenceLoading && !presenceRefreshing)
        revalidatePresence();
    }, 15000);
    return () => clearInterval(timer);
  }, [
    queueDenied,
    queueLoading,
    queueRefreshing,
    revalidateQueue,
    presenceDenied,
    presenceLoading,
    presenceRefreshing,
    revalidatePresence,
    proposal,
  ]);
  function review(available: boolean) {
    if (!fresh || !current || unknown || proposal || renewing.current) return;
    const target = available ? selected : current.branchId;
    if (!target) return;
    const body = {
      expectedVersion: current.version,
      branchId: target,
      available,
      capacity: available ? capacity : current.capacity,
    };
    const epoch = generation.current;
    setProposal({
      title: available
        ? "Set your conversation availability?"
        : "Stop accepting conversations?",
      description: available
        ? "Availability is limited to your current duties, branch support hours and shared capacity. Keep this page open. Hidden or disconnected pages stop renewing after a short lease; logging in alone never makes you available."
        : "New joins are disabled. Existing channels return to queued Care when your availability is reconciled; their case and message history stay available.",
      facts: [
        { label: "Branch", value: label(target) },
        {
          label: "Availability",
          value: available ? "Opt in for this session" : "Unavailable",
        },
        { label: "Concurrent conversations", value: String(body.capacity) },
      ],
      retryAfterRejection: false,
      submit: async () => {
        try {
          const saved = carePresenceSchema.parse(
            (await apiRequest(presencePath, { method: "PUT", csrf: true, body })).data,
          );
          if (!active.current || epoch !== generation.current)
            throw Error("Access changed");
          if (
            saved.version < body.expectedVersion + 1 ||
            (available && (!saved.optedIn || saved.branchId !== target))
          )
            throw Error("Availability outcome needs checking");
          setLeasePaused(false);
          setMessage(undefined);
          presence.refresh();
          queue.revalidate();
        } catch (error) {
          presence.revalidate();
          throw error;
        }
      },
      onUncertain: () => {
        setUnknown(true);
        setLeasePaused(true);
        setProposal(null);
        setMessage(
          "Availability may have changed. Check current availability before another change; nothing will be resent automatically.",
        );
      },
    });
  }
  return (
    <div className={styles.workspace}>
      <OwnerSupportCoverage />
      <section aria-labelledby="care-your-availability">
        <h2 id="care-your-availability">Your availability</h2>
        <p>
          {!current || presence.error || presence.refreshError
            ? "Current joining availability could not be confirmed yet. Check availability before accepting a conversation."
            : !current.enabled
              ? "Live joining is disabled for this release. Queued messages continue in the existing cases."
              : current.optedIn && !leasePaused
                ? "You opted in for this session. Current duties, coverage and capacity still apply to every join."
                : leasePaused
                  ? "This page is not renewing availability. A prior lease may remain active briefly. Check current availability or stop accepting conversations."
                  : "You are not accepting new conversations from this page. Review availability to opt in."}
        </p>
        <Feedback message={message ?? presence.error ?? presence.refreshError} />
        {current?.enabled && (
          <div className={styles.transfer}>
            <label>
              Support branch
              <select
                value={selected}
                disabled={!fresh || !!proposal || unknown}
                onChange={(event) => setChosenBranch(event.target.value)}
              >
                <option value="">Choose an eligible branch</option>
                {current.eligibleBranches.map((branch) => (
                  <option key={branch.branchId} value={branch.branchId}>
                    {label(branch.branchId)}
                  </option>
                ))}
              </select>
            </label>
            {branches.error && (
              <p>
                Branch names could not be loaded; reference prefixes are shown.{" "}
                <button className="text-link" onClick={branches.refresh}>
                  Retry branch names
                </button>
              </p>
            )}
            <label>
              Maximum concurrent conversations
              <select
                value={capacity}
                disabled={!fresh || !!proposal || unknown}
                onChange={(event) => setCapacity(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <p>
              Your branch coverage can impose a lower maximum. An ineligible change is
              rejected without changing availability.
            </p>
          </div>
        )}
        <div className={styles.actions}>
          {current?.enabled && (
            <button
              className="button secondary"
              disabled={
                !fresh ||
                !selected ||
                unknown ||
                !!proposal ||
                !current.eligibleBranches.some((branch) => branch.branchId === selected)
              }
              onClick={() => review(true)}
            >
              Review availability
            </button>
          )}
          {current?.optedIn && (
            <button
              className="button secondary"
              disabled={!fresh || unknown || !!proposal}
              onClick={() => review(false)}
            >
              Stop accepting conversations
            </button>
          )}
          <button
            className="button secondary"
            disabled={presence.loading || presence.refreshing || !!proposal}
            onClick={() => {
              presence.refresh();
              setUnknown(false);
            }}
          >
            Check current availability
          </button>
        </div>
      </section>
      <section aria-labelledby="care-channel-queue">
        <h2 id="care-channel-queue">Conversations in Customer Care</h2>
        <p>
          These link to existing {kind}. Cases are ordered by when their conversation was
          created; no response time is promised.
        </p>
        <label>
          Conversation status
          <select
            value={state}
            disabled={queue.loading || queue.refreshing}
            onChange={(event) => {
              setState(event.target.value);
              setCursor(undefined);
            }}
          >
            <option value="ACTIVE">Queued and joined</option>
            <option value="QUEUED">Queued</option>
            <option value="HUMAN_ACTIVE">Representative joined</option>
            <option value="ENDED">Ended</option>
          </select>
        </label>
        <Feedback message={queue.error ?? queue.refreshError} />
        {queue.refreshError && (
          <p>
            Previously loaded conversations are shown. Refresh before relying on their
            current state.
          </p>
        )}
        {queue.loading && <p role="status">Checking conversations…</p>}
        {!queue.loading && !queue.error && queue.data?.items.length === 0 && (
          <p>
            No matching conversations on this page.{" "}
            {queue.data.nextCursor
              ? "Continue to check the next page."
              : "Ordinary Care cases remain available below."}
          </p>
        )}
        {!queue.error && (
          <ul className={styles.queue}>
            {queue.data?.items.map((channel) => (
              <li key={channel.id}>
                <Link
                  href={
                    managed
                      ? `/admin/workforce/${channel.target.kind === "ENQUIRY" ? "enquiries" : "complaints"}?selected=${channel.target.id}`
                      : `/admin/support/${channel.target.kind === "ENQUIRY" ? "enquiries" : "complaints"}/${channel.target.id}`
                  }
                >
                  {channel.target.kind === "ENQUIRY" ? "Enquiry" : "Complaint"}{" "}
                  {channel.target.id.slice(0, 8)}
                </Link>
                <span>
                  {channel.state === "QUEUED"
                    ? "Queued"
                    : channel.state === "HUMAN_ACTIVE"
                      ? channel.assignedToYou
                        ? "Joined by you"
                        : "Representative joined"
                      : "Ended"}
                </span>
                {channel.queuedSince && (
                  <small>
                    Queued since{" "}
                    <time dateTime={channel.queuedSince}>
                      {formatBusinessDate(channel.queuedSince)}
                    </time>
                  </small>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button
            className="button secondary"
            disabled={queue.loading || queue.refreshing}
            onClick={queue.refresh}
          >
            Refresh conversations
          </button>
          <button
            className="button secondary"
            disabled={!cursor || queue.loading || queue.refreshing}
            onClick={() => setCursor(undefined)}
          >
            First conversation page
          </button>
          <button
            className="button secondary"
            disabled={
              !queue.data?.nextCursor ||
              !!queue.error ||
              !!queue.refreshError ||
              queue.loading ||
              queue.refreshing
            }
            onClick={() => setCursor(queue.data?.nextCursor)}
          >
            Next conversation page
          </button>
        </div>
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => undefined}
        />
      )}
    </div>
  );
}
