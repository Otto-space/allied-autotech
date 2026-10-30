"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { WORKFORCE_ACCESS_CHANGED } from "@/lib/workforce-invalidation";
import {
  assertCoverageTarget,
  careCoverageRecoverySchema,
  coverageDays,
  coverageDraftBody,
  coverageMatches,
  coverageTime,
  newCoverageDraft,
  type CoverageDraft,
} from "@/lib/api/support-coverage-schemas";
import {
  clearCoveragePending,
  coverageRecoveryOwner,
  readCoveragePending,
  saveCoveragePending,
  type CoveragePending,
} from "@/lib/support/coverage-pending";
import { newChannelOperationKey } from "@/lib/support/channel-pending";
import { useAccountSession } from "./dashboard-shell";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import shared from "./support-channel-panel.module.css";
import styles from "./support-coverage-editor.module.css";

const branchesSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string().min(1) })).max(100),
  nextCursor: z.uuid().optional(),
});
export function OwnerSupportCoverage() {
  const session = useAccountSession();
  const [open, setOpen] = useState(false);
  if (
    process.env.NEXT_PUBLIC_OWNER_SUPPORT_COVERAGE_ENABLED !== "true" ||
    session?.user.role !== "SUPER_ADMIN"
  )
    return null;
  return (
    <details
      id="care-support-coverage"
      className={shared.panel}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Branch support coverage (owner)</summary>
      {open && (
        <CoverageSelector
          key={`${session.id}:${session.user.id}`}
          userId={session.user.id}
        />
      )}
    </details>
  );
}
function CoverageSelector({ userId }: { userId: string }) {
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState(""),
    [name, setName] = useState("");
  const [scopeError, setScopeError] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, CoverageDraft>>({});
  const branches = useResource(
    `/public/branches?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
    branchesSchema.parse,
  );
  useEffect(() => {
    function discard() {
      setDrafts({});
      setSelected("");
      setName("");
    }
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    return () => {
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    };
  }, []);
  return (
    <div className={styles.editor}>
      <p>
        Set approved Customer Care support hours in Lagos time. These are separate from
        workshop opening hours. Saving coverage does not release live chat or make
        representatives available.
      </p>
      <label>
        Coverage branch
        <select
          value={selected}
          disabled={branches.loading || branches.refreshing}
          onChange={(event) => {
            setScopeError(undefined);
            setSelected(event.target.value);
            setName(
              branches.data?.items.find((branch) => branch.id === event.target.value)
                ?.name ?? "",
            );
          }}
        >
          <option value="">Choose an active branch</option>
          {selected && !branches.data?.items.some((branch) => branch.id === selected) && (
            <option value={selected}>{name}</option>
          )}
          {branches.data?.items.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      <Feedback message={scopeError ?? branches.error ?? branches.refreshError} />
      {branches.loading && <p role="status">Checking active branches…</p>}
      {!branches.loading && branches.data?.items.length === 0 && (
        <p>
          No active branches were returned. Check the branch directory before configuring
          coverage.
        </p>
      )}
      <div className={shared.actions}>
        <button
          className="button secondary"
          disabled={branches.loading || branches.refreshing}
          onClick={branches.refresh}
        >
          Refresh coverage branches
        </button>
        {cursor && (
          <button
            className="button secondary"
            disabled={branches.loading}
            onClick={() => setCursor(undefined)}
          >
            First branches
          </button>
        )}
        {branches.data?.nextCursor && (
          <button
            className="button secondary"
            disabled={branches.loading}
            onClick={() => setCursor(branches.data?.nextCursor)}
          >
            More branches
          </button>
        )}
      </div>
      {selected && (
        <CoverageBranchEditor
          key={selected}
          userId={userId}
          branchId={selected}
          name={name}
          initialDraft={drafts[selected]}
          onDenied={() => {
            setDrafts({});
            setSelected("");
            setScopeError(
              "Current owner access to that branch's coverage could not be verified. Recheck your session and active branch before continuing.",
            );
          }}
          onDraft={(draft) =>
            setDrafts((old) =>
              old[selected] === draft ? old : { ...old, [selected]: draft },
            )
          }
        />
      )}
    </div>
  );
}
function CoverageBranchEditor({
  userId,
  branchId,
  name,
  initialDraft,
  onDraft,
  onDenied,
}: {
  userId: string;
  branchId: string;
  name: string;
  initialDraft?: CoverageDraft;
  onDraft: (draft: CoverageDraft) => void;
  onDenied: () => void;
}) {
  const root = `/admin/workforce/support-chat/coverage/${branchId}`;
  const parse = useCallback(
    (value: unknown) => assertCoverageTarget(value, branchId),
    [branchId],
  );
  const record = useResource(root, parse);
  const [draft, setDraft] = useState(initialDraft),
    [storageOwner, setStorageOwner] = useState<string>();
  const [pending, setPending] = useState<CoveragePending | null>(null),
    [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>(),
    [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [working, setWorking] = useState(false);
  const alive = useRef(false),
    generation = useRef(0),
    running = useRef(false);
  const summary = useRef<HTMLDivElement>(null),
    recovery = useRef<HTMLHeadingElement>(null);
  const windowFocus = useRef<string | null>(null);
  useEffect(() => {
    if (windowFocus.current && draft) {
      document.getElementById(windowFocus.current)?.focus();
      windowFocus.current = null;
    }
  }, [draft]);
  const draftCallback = useRef(onDraft);
  const deniedCallback = useRef(onDenied);
  const latest = record.denied || record.error ? undefined : record.data;
  const stale = !!latest && !!draft && latest.version > draft.base.version;
  const reading = record.loading || record.refreshing;
  const blocked =
    !latest ||
    !draft ||
    !ready ||
    !!storageError ||
    !!pending ||
    !!proposal ||
    working ||
    reading ||
    !!record.refreshError ||
    stale ||
    latest.version < draft.base.version;
  useEffect(() => {
    draftCallback.current = onDraft;
  }, [onDraft]);
  useEffect(() => {
    deniedCallback.current = onDenied;
  }, [onDenied]);
  useEffect(() => {
    if (record.denied) deniedCallback.current();
  }, [record.denied]);
  useEffect(() => {
    if (draft) draftCallback.current(draft);
  }, [draft]);
  useEffect(() => {
    if (!latest || draft) return;
    let current = true;
    queueMicrotask(() => {
      if (current) setDraft(newCoverageDraft(latest));
    });
    return () => {
      current = false;
    };
  }, [latest, draft]);
  useEffect(() => {
    alive.current = true;
    function advanceGeneration() {
      generation.current++;
    }
    let current = true;
    void coverageRecoveryOwner(userId, branchId)
      .then((owner) => {
        if (!current) return;
        setStorageOwner(owner);
        try {
          setPending(readCoveragePending(owner));
          setReady(true);
        } catch {
          setStorageError(
            "The saved coverage reminder could not be read. Check coverage and audit history, then sign out and back in before making another change.",
          );
        }
      })
      .catch(() => {
        if (current)
          setStorageError(
            "Recovery storage is unavailable. Coverage can be read, but saving is disabled.",
          );
      });
    function discard() {
      advanceGeneration();
      setDraft(undefined);
      setProposal(null);
      setMessage(undefined);
      setReady(false);
    }
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    return () => {
      current = false;
      alive.current = false;
      advanceGeneration();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    };
  }, [userId, branchId]);
  useEffect(() => {
    if (!proposal && pending) recovery.current?.focus({ preventScroll: true });
    else if (!proposal && (error || message))
      summary.current?.focus({ preventScroll: true });
  }, [proposal, pending, error, message]);
  function edit(change: Partial<CoverageDraft>) {
    setDraft((old) => (old ? { ...old, ...change } : old));
    setError(undefined);
    setMessage(undefined);
  }
  function forget() {
    if (!storageOwner) throw Error("Recovery storage is not ready.");
    clearCoveragePending(storageOwner);
    setPending(null);
  }
  function checkEpoch(epoch: number) {
    if (!alive.current || epoch !== generation.current)
      throw new DOMException("Access changed", "AbortError");
  }
  function review() {
    if (blocked || !draft || !storageOwner) return;
    let body;
    try {
      body = coverageDraftBody(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check the coverage fields.");
      return;
    }
    const operationKey = newChannelOperationKey();
    setProposal({
      title: "Save this branch's support coverage?",
      description:
        "This configures approved support coverage only. Live release, current duties, explicit representative availability and shared capacity still govern every join.",
      facts: [
        { label: "Branch", value: name },
        {
          label: "Coverage policy",
          value: body.enabled
            ? "Enabled when live support is released and staffed"
            : "Disabled",
        },
        { label: "Timezone", value: "Africa/Lagos" },
        {
          label: "Maximum per representative",
          value: String(body.maxConcurrentPerAgent),
        },
        ...body.schedule.windows.map((window, i) => ({
          label: `Support window ${i + 1}`,
          value: `${coverageDays[window.day]} ${coverageTime(window.startMinute)}–${coverageTime(window.endMinute)}`,
        })),
        { label: "Private audit reason", value: body.reason },
      ],
      retryAfterRejection: false,
      submit: async () => {
        if (running.current) throw Error("A coverage action is already running.");
        let previous: CoveragePending | null;
        try {
          previous = readCoveragePending(storageOwner);
        } catch {
          const message = "Recovery storage could not be read. No change was sent.";
          setStorageError(message);
          const rejected = new ApiError(422, { error: { code: "VALIDATION_ERROR" } });
          rejected.message = message;
          throw rejected;
        }
        if (previous) {
          setPending(previous);
          const rejected = new ApiError(409, { error: { code: "IDEMPOTENCY_CONFLICT" } });
          rejected.message =
            "Check the earlier saved action first. No new change was sent.";
          throw rejected;
        }
        try {
          saveCoveragePending(storageOwner, { operationKey });
        } catch {
          const message = "Recovery storage is unavailable. No change was sent.";
          setStorageError(message);
          const rejected = new ApiError(422, { error: { code: "VALIDATION_ERROR" } });
          rejected.message = message;
          throw rejected;
        }
        setPending({ operationKey });
        running.current = true;
        setWorking(true);
        const epoch = generation.current;
        try {
          const response = await apiRequest(root, {
            method: "PUT",
            csrf: true,
            idempotencyKey: operationKey,
            body,
          });
          checkEpoch(epoch);
          const saved = parse(response.data);
          if (saved.version !== body.expectedVersion + 1 || !coverageMatches(saved, body))
            throw Error(
              "Coverage result could not be confirmed. Check the saved action.",
            );
          forget();
          setDraft(newCoverageDraft(saved));
          record.revalidate();
          setMessage(
            "Support coverage saved. This did not release live chat or opt in a representative.",
          );
        } catch (caught) {
          if (
            alive.current &&
            epoch === generation.current &&
            caught instanceof ApiError &&
            caught.status >= 400 &&
            caught.status < 500 &&
            ![408, 429].includes(caught.status) &&
            caught.code !== "IDEMPOTENCY_EXPIRED"
          )
            forget();
          if (
            caught instanceof ApiError &&
            caught.status === 409 &&
            caught.code !== "IDEMPOTENCY_EXPIRED"
          )
            record.revalidate();
          if (
            alive.current &&
            epoch === generation.current &&
            caught instanceof ApiError &&
            [401, 403, 404].includes(caught.status)
          )
            deniedCallback.current();
          throw caught;
        } finally {
          running.current = false;
          if (alive.current) setWorking(false);
        }
      },
      onUncertain: () => {
        setProposal(null);
        setMessage(
          "The coverage result is unconfirmed. Check the saved action; nothing will be sent again automatically.",
        );
      },
    });
  }
  async function recover(cancel = false) {
    if (!pending || !storageOwner || running.current) return;
    const epoch = generation.current;
    running.current = true;
    setWorking(true);
    setError(undefined);
    try {
      const response = await apiRequest(
        `${root}/operations/${pending.operationKey}`,
        cancel ? { method: "DELETE", csrf: true } : {},
      );
      checkEpoch(epoch);
      const result = careCoverageRecoverySchema.parse(response.data);
      assertCoverageTarget(result.coverage, branchId);
      if (result.state === "UNKNOWN") {
        if (cancel)
          throw Error(
            "Cancellation could not be confirmed. Keep the reminder and check the saved action.",
          );
        setMessage(
          "No saved outcome is confirmed yet. Keep this reminder or review cancellation before starting another coverage change.",
        );
        return;
      }
      forget();
      if (result.state === "SAVED") {
        setDraft(newCoverageDraft(result.coverage));
        setMessage(
          result.coverage.version === result.savedVersion
            ? "The earlier coverage change was saved. No change was resent."
            : `The earlier change saved revision ${result.savedVersion}. Current revision ${result.coverage.version} changed again; review the current settings before editing.`,
        );
      } else
        setMessage(
          "The unsaved coverage change is cancelled. Already-saved changes were preserved.",
        );
      record.revalidate();
    } catch (caught) {
      if (
        alive.current &&
        epoch === generation.current &&
        caught instanceof ApiError &&
        [401, 403, 404].includes(caught.status)
      )
        deniedCallback.current();
      if (alive.current && epoch === generation.current)
        setError(
          caught instanceof Error ? caught.message : "Coverage recovery is unavailable.",
        );
      throw caught;
    } finally {
      running.current = false;
      if (alive.current) setWorking(false);
    }
  }
  function reviewCancel() {
    if (!pending || working || proposal) return;
    setProposal({
      title: "Cancel the unconfirmed coverage change?",
      description:
        "This blocks the original operation only if it has not saved. If it already saved, its result is preserved and checked instead. It does not disable or undo existing coverage.",
      facts: [{ label: "Branch", value: name }],
      submit: () => recover(true),
      retrySafely: true,
    });
  }
  return (
    <section className={styles.editor} aria-label={`${name} support coverage`}>
      <div ref={summary} tabIndex={-1}>
        <Feedback
          message={error ?? storageError ?? record.error ?? record.refreshError}
        />
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </div>
      {pending && (
        <section className={shared.recovery}>
          <h3 ref={recovery} tabIndex={-1}>
            Check an earlier coverage change
          </h3>
          <p>
            The previous outcome is unconfirmed. This reminder contains only an operation
            reference. Saving stays locked until its outcome is checked.
          </p>
          <div className={shared.actions}>
            <button
              className="button secondary"
              disabled={working || !!proposal}
              onClick={() => void recover().catch(() => undefined)}
            >
              Check saved coverage action
            </button>
            <button
              className="button secondary"
              disabled={working || !!proposal}
              onClick={reviewCancel}
            >
              Review pending cancellation
            </button>
          </div>
        </section>
      )}
      {reading && <p role="status">Checking current support coverage…</p>}
      <button
        className="button secondary"
        disabled={reading || working || !!proposal}
        onClick={record.revalidate}
      >
        Refresh current coverage
      </button>
      {latest && draft && (
        <>
          <p>
            Current revision {latest.version}.{" "}
            {latest.version === 0
              ? "Support coverage has not been configured."
              : latest.enabled
                ? "Coverage policy is enabled; live release and staffing checks still apply."
                : "Coverage policy is disabled."}
          </p>
          {stale && (
            <div className={shared.recovery}>
              <h3>Coverage changed while you were editing</h3>
              <p>
                Your unsaved settings are retained. Current windows:{" "}
                {latest.schedule.windows.length
                  ? latest.schedule.windows
                      .map(
                        (window) =>
                          `${coverageDays[window.day]} ${coverageTime(window.startMinute)}–${coverageTime(window.endMinute)}`,
                      )
                      .join("; ")
                  : "none"}
                . Current maximum: {latest.maxConcurrentPerAgent}. Policy:{" "}
                {latest.enabled ? "enabled" : "disabled"}.
              </p>
              <button
                className="button secondary"
                disabled={reading || working || !!pending || !!proposal}
                onClick={() => edit({ base: latest })}
              >
                Use retained settings with current revision
              </button>{" "}
              <button
                className="button secondary"
                disabled={working || !!pending || !!proposal}
                onClick={() => setDraft(newCoverageDraft(latest))}
              >
                Discard retained settings
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            <fieldset
              disabled={
                !ready ||
                !!storageError ||
                !!pending ||
                working ||
                !!proposal ||
                record.denied ||
                !!record.error ||
                !!record.refreshError
              }
            >
              <legend>Approved coverage for {name}</legend>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => edit({ enabled: event.target.checked })}
                />
                Allow joins during these hours when live support is released and staffed
              </label>
              <label>
                Maximum concurrent conversations per representative
                <select
                  value={draft.capacity}
                  onChange={(event) => edit({ capacity: event.target.value })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <p id="care-coverage-time-help">
                Lagos time (Africa/Lagos), using HH:mm in 24-hour time. An end may be
                24:00. Split overnight coverage into two days. No approved hours are
                filled in automatically.
              </p>
              {draft.windows.map((window, i) => (
                <fieldset
                  className={styles.window}
                  key={window.key}
                  aria-describedby="care-coverage-time-help"
                >
                  <legend>Support window {i + 1}</legend>
                  <label>
                    Day
                    <select
                      id={`care-coverage-day-${window.key}`}
                      value={window.day}
                      onChange={(event) =>
                        edit({
                          windows: draft.windows.map((value) =>
                            value.key === window.key
                              ? { ...value, day: event.target.value }
                              : value,
                          ),
                        })
                      }
                    >
                      <option value="">Choose day</option>
                      {coverageDays.map((day, n) => (
                        <option key={day} value={n}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Start time
                    <input
                      value={window.start}
                      maxLength={5}
                      placeholder="HH:mm"
                      inputMode="text"
                      onChange={(event) =>
                        edit({
                          windows: draft.windows.map((value) =>
                            value.key === window.key
                              ? { ...value, start: event.target.value }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    End time
                    <input
                      value={window.end}
                      maxLength={5}
                      placeholder="HH:mm"
                      inputMode="text"
                      onChange={(event) =>
                        edit({
                          windows: draft.windows.map((value) =>
                            value.key === window.key
                              ? { ...value, end: event.target.value }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Remove support window ${i + 1}`}
                    onClick={() => {
                      const next = draft.windows[i + 1] ?? draft.windows[i - 1];
                      windowFocus.current = next
                        ? `care-coverage-day-${next.key}`
                        : "care-coverage-add";
                      edit({
                        windows: draft.windows.filter(
                          (value) => value.key !== window.key,
                        ),
                      });
                    }}
                  >
                    Remove window
                  </button>
                </fieldset>
              ))}
              <button
                id="care-coverage-add"
                type="button"
                className="button secondary"
                disabled={draft.windows.length >= 28}
                onClick={() => {
                  const key = crypto.randomUUID();
                  windowFocus.current = `care-coverage-day-${key}`;
                  edit({
                    windows: [...draft.windows, { key, day: "", start: "", end: "" }],
                  });
                }}
              >
                Add support window
              </button>
              <label>
                Private audit reason
                <textarea
                  aria-describedby="care-coverage-reason-help"
                  value={draft.reason}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => edit({ reason: event.target.value })}
                />
              </label>
              <small id="care-coverage-reason-help">
                5–500 characters. Stored in the internal audit, not in the browser
                reminder.
              </small>
            </fieldset>
            <button className="button primary" disabled={blocked}>
              Review support coverage
            </button>
          </form>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => undefined}
          confirmLabel="Confirm"
        />
      )}
    </section>
  );
}
