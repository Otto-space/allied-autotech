"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import {
  parseResourceWorkspace,
  validateResourceReceipt,
  type ResourceWorkspace,
} from "@/lib/admin/workshop-resource-policy";
import {
  readResourcePolicyPending,
  markResourcePolicyPending,
  clearResourcePolicyPending,
  resourcePolicyFingerprint,
  redactResourcePolicyChanges,
  type ResourcePolicyPending,
} from "@/lib/admin/workshop-resource-pending";
import {
  emptyResourceDraft,
  resourceDraftFromPlan,
  planFromResourceDraft,
  resourceInstant,
  resourceApprovalTime,
  resourceReviewFacts,
  type ResourceDraft,
} from "@/lib/admin/workshop-resource-draft";
import { workshopResourceSettingsSchema } from "@/lib/admin/workshop-resource-settings";
import { draftIdentity } from "@/lib/forms/drafts";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { useEditorLeaveGuard } from "./use-editor-leave-guard";
import { ResourcePlanFields, useResourceNames } from "./workshop-resource-fields";
import { ResourceVersion } from "./workshop-resource-history";
type Input = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "BRANCH_RESOURCES" }
>;
const seed = (row: PolicyVersion | null) => {
  const parsed = workshopResourceSettingsSchema.safeParse(row?.settings);
  return row?.approvalStatus === "APPROVED" && parsed.success
    ? resourceDraftFromPlan(parsed.data)
    : emptyResourceDraft();
};
class PreflightError extends ApiError {
  constructor() {
    super(409, { error: { code: "CONFLICT" } });
  }
}
function ResourceForm({
  workspace,
  owner,
  branch,
  canApprove,
  onRefresh,
  onDenied,
  dirtyRef,
}: {
  workspace: ResourceWorkspace;
  owner: string;
  branch: string;
  canApprove: boolean;
  onRefresh: () => void;
  onDenied: () => void;
  dirtyRef: RefObject<boolean>;
}) {
  const [draft, setDraft] = useState(() => seed(workspace.current)),
    [draftVersion, setDraftVersion] = useState(workspace.latest?.version ?? 0),
    [dirty, setDirty] = useState(false),
    [source, setSource] = useState(""),
    [evidence, setEvidence] = useState(""),
    [effective, setEffective] = useState(""),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [error, setError] = useState<string>(),
    [success, setSuccess] = useState<string>(),
    [pending, setPending] = useState<ResourcePolicyPending | undefined>(() =>
      readResourcePolicyPending(owner, "SUPER_ADMIN", branch),
    ),
    [recovery, setRecovery] = useState<ResourceWorkspace>(),
    [ack, setAck] = useState(false),
    [recovering, setRecovering] = useState(false);
  const active = useRef(true),
    flight = useRef(false),
    request = useRef<AbortController | null>(null),
    validation = useRef<HTMLDivElement>(null);
  const names = useResourceNames(
    branch,
    draft.services.map((s) => s.serviceId),
    draft.technicians.map((t) => t.staffId),
    onDenied,
  );
  const stale = draftVersion !== (workspace.latest?.version ?? 0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
      dirtyRef.current = false;
    };
  }, [dirtyRef]);
  useEditorLeaveGuard(dirty);
  function changed(next: ResourceDraft) {
    setDraft(next);
    setDirty(true);
    dirtyRef.current = true;
    setSuccess(undefined);
  }
  function invalid(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      validation.current?.focus();
      validation.current?.scrollIntoView({ block: "center" });
    });
  }
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== `${owner}:SUPER_ADMIN`)
      throw new PreflightError();
  }
  async function fresh(signal?: AbortSignal) {
    const [profile, response] = await Promise.all([
      apiRequest("/staff/profile", { signal }).then((r) => parseOwnStaffProfile(r.data)),
      apiRequest(`/admin/policies/booking-resources/${branch}/current`, { signal }),
    ]);
    identity(signal);
    if (
      profile.id !== owner ||
      profile.role !== "SUPER_ADMIN" ||
      profile.status !== "ACTIVE"
    ) {
      onDenied();
      throw new PreflightError();
    }
    return parseResourceWorkspace(response.data, branch);
  }
  function load(row: PolicyVersion | null) {
    if (
      dirty &&
      !window.confirm("Replace this unsaved resource draft with the recorded plan?")
    )
      return;
    setDraft(seed(row));
    setDraftVersion(workspace.latest?.version ?? 0);
    setSource("");
    setEvidence("");
    setEffective("");
    setDirty(false);
    dirtyRef.current = false;
    setError(undefined);
    setSuccess(undefined);
  }
  function review() {
    if (!canApprove || pending || stale) return;
    setError(undefined);
    setSuccess(undefined);
    let plan;
    try {
      plan = planFromResourceDraft(draft);
    } catch (e) {
      invalid(
        e instanceof z.ZodError
          ? "Review the plan: each unit needs a name, category and condition; each technician needs qualified services; working periods must be valid and must not overlap; unavailable periods need dates and a reason."
          : e instanceof Error
            ? e.message
            : "Review this resource plan.",
      );
      return;
    }
    if (
      names.loading ||
      names.error ||
      [
        ...plan.services.map((s) => s.serviceId),
        ...plan.technicians.map((t) => t.staffId),
      ].some((id) => !names.labels[id]?.eligible)
    ) {
      invalid(
        "Verify the selected service and technician names before approval. Retry the lookup or remove unavailable references.",
      );
      return;
    }
    if (
      source.trim().length < 10 ||
      source.trim().length > 500 ||
      evidence.trim().length < 20 ||
      evidence.trim().length > 1000
    ) {
      invalid(
        "Record an approval source in 10–500 characters and written evidence in 20–1,000 characters.",
      );
      return;
    }
    if (
      effective &&
      (!lagosDateTime.safeParse(effective).success ||
        Date.parse(resourceInstant(effective)) <= Date.parse(workspace.evaluatedAt))
    ) {
      invalid(
        "Choose a future date and time in Nigeria time, or leave it empty to apply on confirmation.",
      );
      return;
    }
    const reviewed = plan,
      expectedVersion = draftVersion,
      reviewedSource = source.trim(),
      reviewedEvidence = evidence.trim(),
      start = effective;
    setProposal({
      title: "Approve workshop resource plan",
      description: `This records version ${expectedVersion + 1} for ${workspace.branch.name}. It does not grant staff permissions, displace appointments or release existing allocations. ${workspace.nextScheduled ? "A future plan is already scheduled. An immediate approval applies now; a later scheduled plan can still take effect at its recorded time." : ""}`,
      facts: [
        { label: "Workshop", value: workspace.branch.name },
        {
          label: "Effective",
          value: start ? formatBusinessDate(resourceInstant(start)) : "On confirmation",
        },
        ...resourceReviewFacts(reviewed, names.labels),
        { label: "Approval source", value: reviewedSource },
        { label: "Written evidence", value: reviewedEvidence },
      ],
      retryAfterRejection: false,
      submit: async () => {
        if (flight.current) throw new PreflightError();
        flight.current = true;
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<ResourcePolicyPending, "unknown"> | undefined;
        try {
          identity(controller.signal);
          if (readResourcePolicyPending(owner, "SUPER_ADMIN", branch))
            throw new PreflightError();
          const current = await fresh(controller.signal);
          if (
            !current.branch.isActive ||
            current.branch.updatedAt !== workspace.branch.updatedAt ||
            (current.latest?.version ?? 0) !== expectedVersion
          )
            throw new PreflightError();
          const body: Input = {
            kind: "BRANCH_RESOURCES",
            branchId: branch,
            expectedVersion,
            settings: reviewed,
            source: reviewedSource,
            approvalEvidence: reviewedEvidence,
            effectiveAt: resourceApprovalTime(start, current.evaluatedAt),
          };
          const fingerprint = await resourcePolicyFingerprint(body);
          identity(controller.signal);
          marker = markResourcePolicyPending(owner, "SUPER_ADMIN", branch, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          sent = true;
          const response = await apiRequest("/admin/policies", {
            method: "POST",
            csrf: true,
            body,
            signal: controller.signal,
          });
          const saved = validateResourceReceipt(response.data, body, owner);
          identity(controller.signal);
          clearResourcePolicyPending(owner, "SUPER_ADMIN", branch, marker.token);
          setPending(undefined);
          setDraft(resourceDraftFromPlan(reviewed));
          setDraftVersion(saved.version);
          setSource("");
          setEvidence("");
          setEffective("");
          setDirty(false);
          dirtyRef.current = false;
          setSuccess(
            `Resource plan version ${saved.version} was approved. ${start ? "It is scheduled for its recorded effective time." : "Refresh confirms the version currently in effect."}`,
          );
          onRefresh();
        } catch (e) {
          if (active.current && draftIdentity() === `${owner}:SUPER_ADMIN`) {
            const rejected =
              e instanceof ApiError &&
              e.status >= 400 &&
              e.status < 500 &&
              ![408, 429].includes(e.status);
            if (!sent || rejected) {
              if (marker)
                clearResourcePolicyPending(owner, "SUPER_ADMIN", branch, marker.token);
              setPending(readResourcePolicyPending(owner, "SUPER_ADMIN", branch));
              setError(
                sent
                  ? "The server rejected this approval. Your draft is retained. Refresh the record before reviewing again."
                  : "No approval request was sent. Refresh the record and review your draft.",
              );
              if (!sent) onRefresh();
            } else {
              setPending(readResourcePolicyPending(owner, "SUPER_ADMIN", branch));
              setError(
                "The approval outcome is uncertain. Check the latest record before making another change.",
              );
            }
            if (e instanceof ApiError && [401, 403].includes(e.status)) onDenied();
          }
          throw !sent ? new PreflightError() : e;
        } finally {
          flight.current = false;
          request.current = null;
        }
      },
    });
  }
  async function recover() {
    if (recovering || flight.current) return;
    flight.current = true;
    setRecovering(true);
    setAck(false);
    setRecovery(undefined);
    try {
      const controller = new AbortController();
      request.current = controller;
      const current = await fresh(controller.signal);
      setRecovery(current);
      onRefresh();
    } catch (e) {
      if (active.current) {
        invalid(
          "The latest approval record could not be checked. No approval was resubmitted.",
        );
        if (e instanceof ApiError && [401, 403].includes(e.status)) onDenied();
      }
    } finally {
      if (active.current) setRecovering(false);
      request.current = null;
      flight.current = false;
    }
  }
  return (
    <>
      <section className="resource-panel" aria-label="Current workshop resources">
        <h2>Recorded resource plan</h2>
        <p>
          {workspace.current
            ? `Current version ${workspace.current.version}, effective ${formatBusinessDate(workspace.current.effectiveAt)}`
            : "No approved resource plan is currently in effect."}
        </p>
        <p>
          Latest recorded version: {workspace.latest?.version ?? "none"}. Next scheduled:{" "}
          {workspace.nextScheduled
            ? `version ${workspace.nextScheduled.version}, ${formatBusinessDate(workspace.nextScheduled.effectiveAt)}`
            : "none"}
          .
        </p>
        {workspace.current && (
          <ResourceVersion row={workspace.current} branch={branch} onDenied={onDenied} />
        )}
        <details>
          <summary>
            Resource policy history ({workspace.history.length} latest versions)
          </summary>
          <p>
            Effective time determines the plan in force. History is preserved; an approval
            does not rewrite earlier versions.
          </p>
          {workspace.history.map((row) => (
            <ResourceVersion key={row.id} row={row} branch={branch} onDenied={onDenied} />
          ))}
        </details>
        <p>Checked {formatBusinessDate(workspace.evaluatedAt)}.</p>
      </section>
      {pending && (
        <section
          className="resource-panel resource-recovery"
          aria-label="Approval recovery"
        >
          <h2>Check the earlier approval outcome</h2>
          <p>
            An earlier approval has an unconfirmed outcome. Do not submit it again. Check
            the current record and history, then decide whether a new version is needed.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={recovering}
            onClick={() => void recover()}
          >
            {recovering ? "Checking record…" : "Check latest approval record"}
          </button>
          {recovery && (
            <>
              <p>
                Checked {formatBusinessDate(recovery.evaluatedAt)}. Latest recorded
                version: {recovery.latest?.version ?? "none"}. A newer version alone does
                not prove that the earlier request succeeded.
              </p>
              {recovery.history.map((row) => (
                <ResourceVersion
                  key={row.id}
                  row={row}
                  branch={branch}
                  onDenied={onDenied}
                />
              ))}
              {!recovery.history.length && <p>No resource policy has been recorded.</p>}
              <label className="resource-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I have reviewed the recorded outcome and understand this does not resubmit
                or confirm the earlier request.
              </label>
              <button
                type="button"
                className="button secondary"
                disabled={!ack}
                onClick={() => {
                  try {
                    identity();
                    const current = readResourcePolicyPending(
                      owner,
                      "SUPER_ADMIN",
                      branch,
                    );
                    if (
                      pending !== "unknown" &&
                      (current === "unknown" || current?.token !== pending.token)
                    )
                      throw Error("Recovery reference changed");
                    clearResourcePolicyPending(
                      owner,
                      "SUPER_ADMIN",
                      branch,
                      pending === "unknown" ? undefined : pending.token,
                    );
                    setPending(undefined);
                    setRecovery(undefined);
                    setError(undefined);
                    setSuccess(
                      "Earlier outcome acknowledged. Reload a recorded plan before preparing another approval.",
                    );
                  } catch {
                    invalid(
                      "Recovery could not be acknowledged. Check the latest record again.",
                    );
                  }
                }}
              >
                Acknowledge reviewed outcome
              </button>
            </>
          )}
        </section>
      )}
      <form
        className="resource-panel"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          review();
        }}
      >
        <h2>Review and approve a resource plan</h2>
        <p>
          Record actual people, qualifications, equipment and shared spaces. Draft changes
          stay in this tab and are lost when you leave.
        </p>
        <div className="resource-toolbar">
          <button
            type="button"
            className="button secondary"
            disabled={!!pending}
            onClick={() => load(workspace.current)}
          >
            Use current plan as draft
          </button>
          {workspace.nextScheduled && (
            <button
              type="button"
              className="button secondary"
              disabled={!!pending}
              onClick={() => load(workspace.nextScheduled)}
            >
              Use scheduled plan as draft
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={!!pending}
            onClick={() => load(null)}
          >
            Start empty draft
          </button>
        </div>
        {stale && (
          <Feedback message="A newer resource version was recorded. Your draft is retained; load a recorded plan and review it before another approval." />
        )}
        {!workspace.branch.isActive && (
          <Feedback message="This workshop is inactive. Its history is readable, but new approvals are unavailable." />
        )}
        <fieldset disabled={!canApprove || !!pending || !workspace.branch.isActive}>
          <legend className="sr-only">Workshop resource details</legend>
          <ResourcePlanFields
            draft={draft}
            setDraft={changed}
            branch={branch}
            labels={names.labels}
            onDenied={onDenied}
          />
          <Feedback message={names.error} />
          {names.loading && <p role="status">Verifying selected record names…</p>}
          <button type="button" className="button secondary" onClick={names.refresh}>
            Refresh selected record names
          </button>
          <h3>Written approval</h3>
          <div className="resource-grid">
            <label>
              Effective date and time (Nigeria time, optional)
              <input
                type="datetime-local"
                value={effective}
                onChange={(e) => {
                  setEffective(e.target.value);
                  setDirty(true);
                  dirtyRef.current = true;
                  setSuccess(undefined);
                }}
              />
              <span>Leave empty to apply on confirmation.</span>
            </label>
            <label>
              Approval source
              <input
                value={source}
                maxLength={500}
                onChange={(e) => {
                  setSource(e.target.value);
                  setDirty(true);
                  dirtyRef.current = true;
                  setSuccess(undefined);
                }}
              />
            </label>
            <label className="resource-evidence">
              Written approval or reference
              <textarea
                value={evidence}
                maxLength={1000}
                onChange={(e) => {
                  setEvidence(e.target.value);
                  setDirty(true);
                  dirtyRef.current = true;
                  setSuccess(undefined);
                }}
              />
            </label>
          </div>
          <button className="button" disabled={stale}>
            Review resource approval
          </button>
        </fieldset>
      </form>
      <div ref={validation} tabIndex={-1} className="resource-validation">
        <Feedback message={error} />
      </div>
      <Feedback message={success} tone="success" />
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve resource plan"
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}

function ResourceWorkspaceView({
  branch,
  owner,
  canApprove,
  onDenied,
  dirtyRef,
}: {
  branch: string;
  owner: string;
  canApprove: boolean;
  onDenied: () => void;
  dirtyRef: RefObject<boolean>;
}) {
  const parse = useCallback((v: unknown) => parseResourceWorkspace(v, branch), [branch]),
    record = useResource(`/admin/policies/booking-resources/${branch}/current`, parse);
  useEffect(() => {
    if (record.denied) onDenied();
  }, [record.denied, onDenied]);
  return (
    <>
      <Feedback message={record.error ?? record.refreshError} />
      {record.loading && <p role="status">Loading workshop resource record…</p>}
      {record.data && !record.denied && (
        <ResourceForm
          workspace={record.data}
          owner={owner}
          branch={branch}
          canApprove={
            canApprove && !record.error && !record.refreshError && !record.refreshing
          }
          onRefresh={record.revalidate}
          onDenied={onDenied}
          dirtyRef={dirtyRef}
        />
      )}
      <button
        type="button"
        className="button secondary"
        disabled={record.refreshing}
        onClick={record.data ? record.revalidate : record.refresh}
      >
        {record.refreshing ? "Refreshing record…" : "Refresh resource record"}
      </button>
    </>
  );
}
export function WorkshopResources() {
  const session = useAccountSession(),
    params = useSearchParams(),
    router = useRouter(),
    branch = z.uuid().safeParse(params.get("branch")).success
      ? params.get("branch")!.toLowerCase()
      : "",
    [denied, setDenied] = useState(false),
    dirty = useRef(false),
    profile = useResource(
      session?.user.role === "SUPER_ADMIN" ? "/staff/profile" : null,
      parseOwnStaffProfile,
    );
  const onDenied = useCallback(() => {
    redactResourcePolicyChanges();
    setDenied(true);
  }, []);
  const allowed =
      !denied &&
      !profile.denied &&
      profile.data?.id === session?.user.id &&
      profile.data?.role === "SUPER_ADMIN" &&
      profile.data?.status === "ACTIVE",
    canApprove =
      allowed &&
      !profile.error &&
      !profile.refreshError &&
      !profile.refreshing &&
      !profile.loading;
  return (
    <div className="workshop-resources">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Workshop resources</span>
          </li>
        </ol>
      </nav>
      <header>
        <h1>Workshop resources</h1>
        <p>
          Plan qualified people, equipment and shared spaces against real working time.
        </p>
        <Link
          href={
            branch
              ? `/admin/booking-capacity?branch=${branch}`
              : "/admin/booking-capacity"
          }
        >
          Workshop calendar and daily capacity
        </Link>
      </header>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your owner permission…</p>}
      {allowed ? (
        <>
          <div className="field resource-branch">
            <label htmlFor="resource-branch">Workshop branch</label>
            <AdminBranchPicker
              id="resource-branch"
              activeOnly={false}
              value={branch}
              onDenied={onDenied}
              onChange={(id) => {
                if (id === branch) return;
                if (
                  dirty.current &&
                  !window.confirm("Change branch and discard unsaved resource changes?")
                )
                  return;
                router.replace(
                  id
                    ? `/admin/booking-resources?branch=${id}`
                    : "/admin/booking-resources",
                  { scroll: false },
                );
              }}
            />
          </div>
          {branch ? (
            <ResourceWorkspaceView
              key={session!.user.id + branch}
              branch={branch}
              owner={session!.user.id}
              canApprove={canApprove}
              onDenied={onDenied}
              dirtyRef={dirty}
            />
          ) : (
            <p>Choose a workshop branch to review its actual resource plan.</p>
          )}
        </>
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Resource policy requires an active, verified Super Admin account with MFA." />
            <button
              className="button secondary"
              onClick={() => {
                setDenied(false);
                profile.refresh();
              }}
            >
              Refresh permission
            </button>
          </>
        )
      )}
    </div>
  );
}
