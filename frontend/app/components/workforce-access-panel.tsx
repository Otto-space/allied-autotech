"use client";
import { useCallback, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkforceAccount,
  workforceTemplateLabels,
  workforceTemplateSchema,
  workforceAssignmentLabel,
  workforceHistoryDefinition,
  type WorkforceAccount,
} from "@/lib/api/workforce-schemas";
import {
  verifyWorkforceReceipt,
  workforceBody,
  workforceLocalTime,
  workforcePreviewBody,
  type WorkforceAction,
} from "@/lib/admin/work-staff-workforce";
import { formatBusinessDate } from "@/lib/format/date";
import {
  assignableWorkforcePositionSchema,
  workforcePositionLabels,
} from "@/lib/api/workforce-positions";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { AdminBranchPicker } from "./admin-branch-picker";
import {
  StaffChangeCoordinator,
  useStaffChangeCoordinator,
} from "./staff-change-coordinator";
import "./workforce-access-panel.css";
import { WorkforceEffectiveAccess } from "./workforce-effective-access";
import {
  parseWorkforceAccessPreview,
  type WorkforceAccessPreview,
} from "@/lib/api/workforce-effective-access";

function PasswordReason({
  prefix,
  passwordEpoch,
}: {
  prefix: string;
  passwordEpoch: number;
}) {
  return (
    <>
      <div className="field wf-wide">
        <label htmlFor={`${prefix}-reason`}>Reason</label>
        <textarea
          id={`${prefix}-reason`}
          name="reason"
          required
          minLength={10}
          maxLength={1000}
        />
      </div>
      <PasswordProof key={passwordEpoch} prefix={prefix} />
    </>
  );
}
function PasswordProof({ prefix }: { prefix: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field wf-wide">
      <label htmlFor={`${prefix}-password`}>Your current password</label>
      <div className="wf-password">
        <input
          id={`${prefix}-password`}
          name="currentPassword"
          type={shown ? "text" : "password"}
          required
          autoComplete="current-password"
          maxLength={256}
        />
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          title={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={`${prefix}-password`}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
export function WorkforceAccessPanel({ userId }: { userId: string }) {
  const coordinator = useStaffChangeCoordinator();
  const session = useAccountSession();
  return coordinator ? (
    <WorkforcePanel
      key={`${session?.id}:${session?.user.id}:${session?.user.role}:${userId}`}
      userId={userId}
    />
  ) : (
    <StandaloneWorkforce userId={userId} />
  );
}
function StandaloneWorkforce({ userId }: { userId: string }) {
  const session = useAccountSession(),
    own = useOwnStaffPermissions();
  const allowed =
    !!session &&
    ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) &&
    own.data?.id === session.user.id &&
    own.data.role === session.user.role &&
    own.data.status === "ACTIVE" &&
    !own.error &&
    !own.refreshError;
  const validTarget = z.uuid().safeParse(userId).success;
  if (!allowed || !session || !validTarget)
    return (
      <section className="detail-section">
        <Feedback
          message={
            own.error ||
            own.refreshError ||
            (own.data && !allowed
              ? "Your current staff identity does not permit responsibility management."
              : undefined) ||
            (!validTarget ? "Enter a valid staff user reference." : undefined)
          }
        />
        {own.loading && <p role="status">Checking responsibility access…</p>}
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            own.refresh();
          }}
        >
          Refresh responsibility identity
        </button>
      </section>
    );
  return (
    <StaffChangeCoordinator
      owner={session.user.id}
      role={session.user.role}
      workforceTarget={userId}
      disabled={own.loading || own.refreshing || !!own.error || !!own.refreshError}
      refresh={own.refresh}
    >
      {(change, recovery) => (
        <>
          {recovery}
          <WorkforcePanel
            key={`${session.id}:${userId}:${change.epoch}`}
            userId={userId}
          />
        </>
      )}
    </StaffChangeCoordinator>
  );
}
function WorkforcePanel({ userId }: { userId: string }) {
  const coordinator = useStaffChangeCoordinator()!,
    session = useAccountSession();
  const parse = useCallback(
    (v: unknown) => {
      const r = parseWorkforceAccount(v);
      if (r.userId !== userId) throw Error("Unexpected responsibility account");
      return r;
    },
    [userId],
  );
  const record = useResource(`/admin/workforce/accounts/${userId}`, parse),
    data = record.data;
  const [message, setMessage] = useState<string>(),
    [epoch, setEpoch] = useState(0);
  const [preparing, setPreparing] = useState(false),
    [previewError, setPreviewError] = useState<string>();
  const mounted = useRef(true),
    previewRequest = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewRequest.current?.abort();
    };
  }, []);
  const busy = record.loading || record.refreshing,
    error = record.error || record.refreshError;
  const locked = coordinator.locked || busy || preparing || !!error || !data;
  const current = useRef({ data, coordinator, busy, error });
  useLayoutEffect(() => {
    current.current = { data, coordinator, busy, error };
  }, [data, coordinator, busy, error]);
  function review(
    action: WorkforceAction,
    body: Record<string, unknown>,
    facts: { label: string; value: string }[],
    assignmentId?: string,
  ) {
    if (locked || previewRequest.current || !data || !session) return;
    if (action !== "assign" && action !== "revoke")
      return openReview(action, body, facts, assignmentId);
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreparing(true);
    setPreviewError(undefined);
    setMessage(undefined);
    void apiRequest(`/admin/workforce/accounts/${userId}/access-preview`, {
      method: "POST",
      csrf: true,
      signal: controller.signal,
      body: workforcePreviewBody(action, body, assignmentId),
    })
      .then((response) => {
        controller.signal.throwIfAborted();
        if (!mounted.current) return;
        const preview = parseWorkforceAccessPreview(response.data, {
          userId,
          expectedVersion: body.expectedVersion,
          operation: action,
          account: data,
          input: workforcePreviewBody(action, body, assignmentId),
        });
        const latest = current.current;
        if (
          latest.coordinator.locked ||
          latest.busy ||
          latest.error ||
          latest.data?.access?.version !== body.expectedVersion
        )
          throw new ApiError(409, { error: { code: "STALE_VERSION" } });
        openReview(
          action,
          { ...body, expectedAccessPreview: preview.fingerprint },
          facts,
          assignmentId,
          preview,
        );
      })
      .catch((error) => {
        if (mounted.current && !controller.signal.aborted)
          setPreviewError(
            error instanceof ApiError
              ? error.message
              : "The access change could not be checked. Refresh responsibility access and review it again.",
          );
      })
      .finally(() => {
        if (previewRequest.current === controller) previewRequest.current = null;
        if (mounted.current) setPreparing(false);
      });
  }
  function openReview(
    action: WorkforceAction,
    body: Record<string, unknown>,
    facts: { label: string; value: string }[],
    assignmentId?: string,
    preview?: WorkforceAccessPreview,
  ) {
    if (!data || !session) return;
    const suffix =
      action === "enroll"
        ? ""
        : action === "assign"
          ? "/assignments"
          : action === "delegate"
            ? "/delegation"
            : `/assignments/${assignmentId}/revoke`;
    const title = {
      enroll: data.access ? "Update this job position?" : "Enroll this reviewed account?",
      assign: "Assign this responsibility?",
      revoke: "Revoke this responsibility?",
      delegate: "Update this admin delegation envelope?",
    }[action];
    setMessage(undefined);
    coordinator.review(
      {
        title,
        workforceAccessChange: preview,
        description:
          action === "enroll" && !data.access
            ? "Enrollment replaces broad legacy operational access with explicit responsibilities and revokes existing sessions. No assignments are created automatically. Existing financial grants and business histories are retained. Review previously approved duties before confirming."
            : "Current MFA, password, delegation, target and version will be checked on the server. No system role is changed.",
        facts: [
          { label: "Account", value: data.accountLabel },
          ...facts,
          { label: "Reason", value: String(body.reason) },
        ],
        submit: async () => {
          let current: WorkforceAccount;
          try {
            current = parse(
              (await apiRequest(`/admin/workforce/accounts/${userId}`)).data,
            );
          } catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          }
          const permission = {
            enroll: "canEnroll",
            assign: "canAssign",
            revoke: "canRevoke",
            delegate: "canDelegate",
          }[action] as keyof WorkforceAccount["management"];
          if (
            (current.access?.version ?? null) !== body.expectedVersion ||
            current.management[permission] !== true ||
            (action === "assign" &&
              (current.templatesVersion ?? 1) !== (body.expectedTemplateVersion ?? 1)) ||
            (action === "delegate" &&
              (current.templatesVersion ?? 1) !== (body.expectedPolicyVersion ?? 1)) ||
            (action === "assign" &&
              (!current.management.templates.includes(
                body.template as (typeof current.management.templates)[number],
              ) ||
                (current.management.branchIds !== null &&
                  !current.management.branchIds.includes(String(body.branchId))))) ||
            (action === "revoke" &&
              !current.assignments.some((a) => a.id === assignmentId && !a.revokedAt))
          )
            throw new ApiError(409, { error: { code: "STALE_VERSION" } });
          if (preview && (action === "assign" || action === "revoke")) {
            try {
              const latest = parseWorkforceAccessPreview(
                (
                  await apiRequest(`/admin/workforce/accounts/${userId}/access-preview`, {
                    method: "POST",
                    csrf: true,
                    body: workforcePreviewBody(action, body, assignmentId),
                  })
                ).data,
                {
                  userId,
                  expectedVersion: body.expectedVersion,
                  operation: action,
                  account: current,
                  input: workforcePreviewBody(action, body, assignmentId),
                },
              );
              if (latest.fingerprint !== preview.fingerprint)
                throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            } catch (error) {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500)
                throw error;
              throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
            }
          }
          const result = await apiRequest(
            `/admin/workforce/accounts/${userId}${suffix}`,
            {
              method: action === "enroll" || action === "delegate" ? "PUT" : "POST",
              csrf: true,
              body,
            },
          );
          verifyWorkforceReceipt(
            result.data,
            action,
            userId,
            session.user.id,
            body,
            current,
            assignmentId,
          );
        },
      },
      "workforce",
      () =>
        setMessage("Responsibility change recorded. Current access is being refreshed."),
      record.refresh,
    );
  }
  return (
    <section
      className="detail-section workforce-panel"
      aria-labelledby="workforce-access-title"
    >
      <div className="wf-heading">
        <h2 id="workforce-access-title">Responsibilities & temporary cover</h2>
        <button
          className="button secondary"
          disabled={busy || coordinator.reviewing}
          onClick={record.refresh}
        >
          Refresh responsibility access
        </button>
      </div>
      <Feedback message={error} />
      <Feedback message={message} tone="success" />
      <Feedback message={previewError} />
      {preparing && <p role="status">Checking what access will change…</p>}
      {busy && <p role="status">Checking responsibility access…</p>}
      {error && data && (
        <p className="notice">
          Previously loaded responsibilities are shown. Refresh successfully before making
          changes.
        </p>
      )}
      {record.denied && (
        <p>Responsibility access is unavailable. Protected records have been cleared.</p>
      )}
      {data && (
        <>
          <p>
            {data.access
              ? `Enrolled ${formatBusinessDate(data.access.enabledAt)}. Position: ${workforcePositionLabels[data.access.position as keyof typeof workforcePositionLabels] ?? data.access.position}.`
              : "Legacy access is still active. No responsibilities have been silently assigned."}
          </p>
          {!Object.values(data.management).some((v) => v === true) && (
            <p className="notice">
              Responsibility changes are unavailable for this account under your current
              access.
            </p>
          )}
          <WorkforceEffectiveAccess value={data.effectiveAccess} />
          <WorkforceEditors
            key={`${userId}:${epoch}`}
            data={data}
            locked={locked}
            review={review}
            reload={() => setEpoch((v) => v + 1)}
          />
        </>
      )}
    </section>
  );
}
function WorkforceEditors({
  data,
  locked,
  review,
  reload,
}: {
  data: WorkforceAccount;
  locked: boolean;
  review: (
    action: WorkforceAction,
    body: Record<string, unknown>,
    facts: { label: string; value: string }[],
    assignmentId?: string,
  ) => void;
  reload: () => void;
}) {
  const [draftVersion] = useState(data.access?.version ?? null),
    [passwordEpoch, setPasswordEpoch] = useState(0),
    [error, setError] = useState<string>();
  const [branchId, setBranchId] = useState(""),
    [branchLabel, setBranchLabel] = useState("");
  const [delegated, setDelegated] = useState(data.access?.delegatedBranchIds ?? []),
    [labels, setLabels] = useState<Record<string, string>>({});
  const changed = draftVersion !== (data.access?.version ?? null),
    disabled = locked || changed;
  const branchName = (id: string) =>
    labels[id] ||
    data.branches.find((b) => b.id === id)?.name ||
    "Branch reference unavailable";
  const allowedBranches =
    data.management.branchIds === null
      ? null
      : data.branches.filter(
          (b) => b.isActive && data.management.branchIds!.includes(b.id),
        );
  function submit(
    event: FormEvent<HTMLFormElement>,
    action: WorkforceAction,
    extra: Record<string, unknown>,
    facts: { label: string; value: string }[],
    assignmentId?: string,
  ) {
    event.preventDefault();
    if (disabled) return;
    const form = new FormData(event.currentTarget);
    try {
      const body = workforceBody(action, {
        currentPassword: String(form.get("currentPassword") ?? ""),
        reason: String(form.get("reason") ?? ""),
        expectedVersion: draftVersion,
        ...extra,
      });
      setError(undefined);
      setPasswordEpoch((v) => v + 1);
      review(action, body, facts, assignmentId);
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? e.issues[0]?.message
          : "Review the responsibility fields and try again.",
      );
    }
  }
  return (
    <div className="wf-editors">
      <Feedback message={error} />
      {changed && (
        <div className="notice">
          <p>
            Responsibilities changed while you were reviewing. Inspect the current
            details, then reload the action fields.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={locked}
            onClick={reload}
          >
            Reload responsibility actions
          </button>
        </div>
      )}
      {data.management.canEnroll && (
        <details>
          <summary>
            {data.access ? "Update job position" : "Review legacy access and enroll"}
          </summary>
          <form
            onSubmit={(e) => {
              const f = new FormData(e.currentTarget),
                position = String(f.get("position"));
              submit(e, "enroll", { position }, [
                {
                  label: "Job position",
                  value:
                    workforcePositionLabels[
                      position as keyof typeof workforcePositionLabels
                    ] ?? position,
                },
              ]);
            }}
          >
            <fieldset disabled={disabled} className="wf-fields">
              <div className="field wf-wide">
                <label htmlFor="workforce-position">Job position</label>
                <select
                  id="workforce-position"
                  name="position"
                  required
                  defaultValue={data.access?.position ?? ""}
                >
                  <option value="">Choose a position</option>
                  {assignableWorkforcePositionSchema.options.map((v) => (
                    <option key={v} value={v}>
                      {workforcePositionLabels[v]}
                    </option>
                  ))}
                </select>
              </div>
              <PasswordReason passwordEpoch={passwordEpoch} prefix="workforce-enroll" />
              <button className="button secondary">
                Review {data.access ? "position" : "enrollment"}
              </button>
            </fieldset>
          </form>
        </details>
      )}
      {data.access && (
        <>
          <h3>Recorded responsibilities</h3>
          {!data.assignments.length && <p>No responsibility assignments recorded.</p>}
          <ul className="wf-assignments">
            {data.assignments.map((a) => (
              <li key={a.id}>
                <div className="wf-assignment-heading">
                  <h4>{workforceAssignmentLabel(a.template)}</h4>
                  <span>
                    {a.revokedAt
                      ? "Revoked"
                      : data.activeAssignmentIds.includes(a.id)
                        ? "Active"
                        : "Not currently active"}
                    {a.temporary ? " · Temporary cover" : ""}
                  </span>
                </div>
                <p>
                  {branchName(a.branchId)} ·{" "}
                  {a.scope === "ASSIGNED"
                    ? "Assigned work only"
                    : a.scope === "BRANCH"
                      ? "Branch scope"
                      : `Unrecognised scope: ${a.scope}`}
                </p>
                {!workforceHistoryDefinition(data, a) && (
                  <p className="notice">
                    The recorded responsibility, definition version{" "}
                    {a.templateVersion ?? 1} or scope is unsupported. This assignment
                    grants no access. Ask the owner to review it, or revoke the assignment
                    if authorised.
                  </p>
                )}
                <details>
                  <summary>Assignment details</summary>
                  <dl>
                    <div>
                      <dt>Recorded responsibility</dt>
                      <dd>{a.template}</dd>
                    </div>
                    <div>
                      <dt>Starts</dt>
                      <dd>{formatBusinessDate(a.startsAt)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {a.expiresAt
                          ? formatBusinessDate(a.expiresAt)
                          : "No expiry specified"}
                      </dd>
                    </div>
                    <div>
                      <dt>Reason</dt>
                      <dd>{a.reason}</dd>
                    </div>
                    <div>
                      <dt>Assigned by reference</dt>
                      <dd>{a.assignedByUserId}</dd>
                    </div>
                    <div>
                      <dt>Recorded</dt>
                      <dd>{formatBusinessDate(a.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Definition version</dt>
                      <dd>{a.templateVersion ?? 1}</dd>
                    </div>
                    <div>
                      <dt>Supported actions</dt>
                      <dd>
                        {workforceHistoryDefinition(data, a)
                          ?.actions.map((v) => v.toLowerCase().replaceAll("_", " "))
                          .join(", ") || "No action details available"}
                      </dd>
                    </div>
                    {a.revokedAt && (
                      <>
                        <div>
                          <dt>Revoked</dt>
                          <dd>{formatBusinessDate(a.revokedAt)}</dd>
                        </div>
                        <div>
                          <dt>Revoked by reference</dt>
                          <dd>{a.revokedByUserId}</dd>
                        </div>
                        <div>
                          <dt>Revocation reason</dt>
                          <dd>{a.revocationReason}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </details>
                {!a.revokedAt && data.management.canRevoke && (
                  <details>
                    <summary>Revoke this responsibility</summary>
                    <form
                      onSubmit={(e) =>
                        submit(
                          e,
                          "revoke",
                          {},
                          [
                            {
                              label: "Responsibility",
                              value: workforceAssignmentLabel(a.template),
                            },
                            { label: "Branch", value: branchName(a.branchId) },
                          ],
                          a.id,
                        )
                      }
                    >
                      <fieldset className="wf-fields" disabled={disabled}>
                        <PasswordReason
                          passwordEpoch={passwordEpoch}
                          prefix={`revoke-${a.id}`}
                        />
                        <button className="button secondary">Review revocation</button>
                      </fieldset>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">
            Removing one assignment retains permissions granted by other active
            assignments. Expired and revoked assignments grant no access.
          </p>
        </>
      )}
      {data.management.canAssign && (
        <details>
          <summary>Assign responsibility</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const template = String(f.get("template")),
                  startsAt = workforceLocalTime(f.get("startsAt")),
                  expiresAt = f.get("expiresAt")
                    ? workforceLocalTime(f.get("expiresAt"))
                    : null;
                submit(
                  e,
                  "assign",
                  {
                    template,
                    expectedTemplateVersion: data.templatesVersion ?? 1,
                    branchId,
                    temporary: f.get("temporary") === "on",
                    startsAt,
                    expiresAt,
                  },
                  [
                    {
                      label: "Responsibility",
                      value:
                        workforceTemplateLabels[
                          template as keyof typeof workforceTemplateLabels
                        ] ?? template,
                    },
                    {
                      label: "Definition version",
                      value: String(data.templatesVersion ?? 1),
                    },
                    { label: "Branch", value: branchLabel },
                    {
                      label: "Cover",
                      value: f.get("temporary") === "on" ? "Temporary" : "Regular",
                    },
                    { label: "Starts", value: formatBusinessDate(startsAt) },
                    {
                      label: "Expires",
                      value: expiresAt
                        ? formatBusinessDate(expiresAt)
                        : "No expiry specified",
                    },
                  ],
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Choose valid dates.");
              }
            }}
          >
            <fieldset className="wf-fields" disabled={disabled}>
              <div className="field">
                <label htmlFor="workforce-template">Responsibility</label>
                <select id="workforce-template" name="template" required defaultValue="">
                  <option value="">Choose a responsibility</option>
                  {data.management.templates.map((v) => (
                    <option key={v} value={v}>
                      {workforceTemplateLabels[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="workforce-branch">Branch</label>
                {allowedBranches ? (
                  <select
                    id="workforce-branch"
                    required
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setBranchLabel(e.target.selectedOptions[0]?.textContent ?? "");
                    }}
                  >
                    <option value="">Choose an active branch</option>
                    {allowedBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <AdminBranchPicker
                    id="workforce-branch"
                    value={branchId}
                    onChange={(id, label) => {
                      setBranchId(id);
                      setBranchLabel(label);
                    }}
                  />
                )}
              </div>
              <div className="field">
                <label htmlFor="workforce-starts">Starts at (your device time)</label>
                <input
                  id="workforce-starts"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="workforce-expires">
                  Expires at (optional, your device time)
                </label>
                <input id="workforce-expires" name="expiresAt" type="datetime-local" />
              </div>
              <label className="wf-check wf-wide">
                <input type="checkbox" name="temporary" />
                Temporary cover
              </label>
              <PasswordReason passwordEpoch={passwordEpoch} prefix="workforce-assign" />
              <button className="button">Review responsibility assignment</button>
            </fieldset>
          </form>
        </details>
      )}
      {data.management.canDelegate && (
        <details>
          <summary>Owner-approved admin delegation envelope</summary>
          <p>
            This authorizes responsibility assignment within selected templates and
            branches. It grants no operational or financial powers to the administrator.
          </p>
          <form
            onSubmit={(e) => {
              const f = new FormData(e.currentTarget);
              const templates = f.getAll("templates").map(String);
              submit(
                e,
                "delegate",
                {
                  templates,
                  expectedPolicyVersion: data.templatesVersion ?? 1,
                  branchIds: delegated,
                  allowAdminInvitations: f.get("allowAdminInvitations") === "on",
                },
                [
                  {
                    label: "Definition version",
                    value: String(data.templatesVersion ?? 1),
                  },
                  {
                    label: "Responsibilities",
                    value:
                      templates
                        .map(
                          (v) =>
                            workforceTemplateLabels[
                              v as keyof typeof workforceTemplateLabels
                            ],
                        )
                        .join(", ") || "None",
                  },
                  {
                    label: "Branches",
                    value: delegated.map(branchName).join(", ") || "None",
                  },
                  {
                    label: "Admin invitations",
                    value:
                      f.get("allowAdminInvitations") === "on"
                        ? "Permitted within selected branches"
                        : "Not permitted",
                  },
                ],
              );
            }}
          >
            <fieldset className="wf-fields" disabled={disabled}>
              <fieldset className="wf-wide wf-checks">
                <legend>Responsibilities this admin may assign</legend>
                {workforceTemplateSchema.options
                  .filter((v) => Object.hasOwn(data.templates, v))
                  .map((v) => (
                    <label className="wf-check" key={v}>
                      <input
                        type="checkbox"
                        name="templates"
                        value={v}
                        defaultChecked={data.access?.delegatedTemplates.includes(v)}
                      />
                      {workforceTemplateLabels[v]}
                    </label>
                  ))}
              </fieldset>
              <div className="field wf-wide">
                <label htmlFor="workforce-delegated-branch">Add a permitted branch</label>
                <AdminBranchPicker
                  id="workforce-delegated-branch"
                  value=""
                  onChange={(id, label) => {
                    if (!id || delegated.includes(id)) return;
                    if (delegated.length >= 20) {
                      setError("Select at most 20 permitted branches.");
                      return;
                    }
                    setLabels((v) => ({ ...v, [id]: label }));
                    setDelegated((v) => [...v, id]);
                  }}
                />
                <ul className="wf-selected-branches">
                  {delegated.map((id) => (
                    <li key={id}>
                      <span>
                        {branchName(id)}
                        {data.branches.find((b) => b.id === id)?.isActive === false
                          ? " (inactive; remove before saving)"
                          : ""}
                      </span>
                      <button
                        type="button"
                        className="text-link"
                        aria-label={`Remove ${branchName(id)} from permitted branches`}
                        onClick={() => setDelegated((v) => v.filter((x) => x !== id))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <label className="wf-check wf-wide">
                <input
                  type="checkbox"
                  name="allowAdminInvitations"
                  defaultChecked={data.access?.delegatedTemplates.includes(
                    "ADMIN_INVITE",
                  )}
                />
                Permit secure admin invitations within these branches
              </label>
              <PasswordReason
                passwordEpoch={passwordEpoch}
                prefix="workforce-delegation"
              />
              <button className="button secondary">Review delegation envelope</button>
            </fieldset>
          </form>
        </details>
      )}
    </div>
  );
}
