"use client";
import { useCallback, useEffect, useId, useState } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invitationSchema, type InvitationValues } from "@/lib/forms/staff-admin";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import {
  parseCandidates,
  parseInvitations,
  parseQueuedInvitation,
  invitationRecordSchema,
} from "@/lib/api/team-access-schemas";
import { parseStaffMember } from "@/lib/api/staff-admin-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import {
  invitationQuery,
  invitationPageParams,
} from "@/lib/admin/work-staff-invitations";
import { Feedback } from "./feedback";
import { InvitationChangeCoordinator } from "./invitation-change-coordinator";

const searchSchema = z.object({
  email: z.email("Enter the account’s exact email address.").max(254),
});
const defaults: InvitationValues = { currentPassword: "", branchId: "" };
export function StaffInvitationForm() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return <Feedback message="Administrator access is required to manage team access." />;
  return <InvitationWorkspace key={`${session.user.id}:${session.user.role}`} />;
}
function InvitationWorkspace() {
  const session = useAccountSession();
  const own = useOwnStaffPermissions();
  const allowed =
    !!session &&
    own.data?.id === session.user.id &&
    own.data.role === session.user.role &&
    own.data.status === "ACTIVE" &&
    !own.error &&
    !own.refreshError;
  const search = useForm({
    resolver: zodResolver(searchSchema),
    defaultValues: { email: "" },
  });
  const form = useForm<InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: defaults,
  });
  const [email, setEmail] = useState("");
  const [branchLabel, setBranchLabel] = useState("");
  const [message, setMessage] = useState<string>();
  const [passwordShown, setPasswordShown] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1251px)");
    const update = () => setGuidanceOpen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = invitationQuery(new URLSearchParams(searchParams.toString()));
  const status = view.params.get("status") ?? "";
  const navigate = (params: URLSearchParams) =>
    router.push(`/admin/staff/invite${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  const parseCandidate = useCallback(
    (value: unknown) => parseCandidates(value, email),
    [email],
  );
  const candidates = useResource(
    allowed && email
      ? `/admin/staff/candidates?email=${encodeURIComponent(email)}`
      : null,
    parseCandidate,
  );
  const listQuery = view.params.toString();
  const actorId = session?.user.id;
  const actorRole = session?.user.role;
  const parsePage = useCallback(
    (value: unknown) =>
      parseInvitations(
        value,
        new URLSearchParams(listQuery),
        actorId && actorRole ? { id: actorId, role: actorRole } : undefined,
      ),
    [listQuery, actorId, actorRole],
  );
  const invitations = useResource(allowed ? view.path : null, parsePage);
  const reset = useCallback(() => {
    form.reset(defaults);
    search.reset({ email: "" });
    setEmail("");
    setMessage(undefined);
    setBranchLabel("");
    setPasswordShown(false);
  }, [form, search]);
  const mutation = useAccountMutation(reset);
  const candidate = candidates.data?.items[0];
  const baseDisabled =
    mutation.busy ||
    mutation.sessionChanged ||
    view.invalid ||
    own.loading ||
    own.refreshing ||
    candidates.refreshing ||
    candidates.loading ||
    !!candidates.error ||
    !!candidates.refreshError ||
    invitations.refreshing ||
    invitations.loading ||
    !!invitations.error ||
    !!invitations.refreshError;
  async function submit(path: string, body: Record<string, unknown>) {
    const controller = mutation.begin();
    if (!controller) throw new Error("An access change is already pending");
    try {
      const result = await apiRequest(path, {
        method: "POST",
        body,
        csrf: true,
        signal: controller.signal,
      });
      if (controller.signal.aborted) throw new Error("Account changed");
      return result.data;
    } finally {
      form.setValue("currentPassword", "");
      setPasswordShown(false);
      mutation.finish(controller);
    }
  }
  if (!allowed)
    return (
      <>
        <h1>Promotions & invitations</h1>
        <Feedback
          message={
            own.error ||
            own.refreshError ||
            (own.data
              ? "Your current staff identity does not permit team access management."
              : undefined)
          }
        />
        {own.loading && <p role="status">Checking team access…</p>}
        <button className="button secondary" onClick={own.refresh}>
          Refresh team access
        </button>
      </>
    );
  return (
    <InvitationChangeCoordinator
      owner={session.user.id}
      role={session.user.role}
      disabled={own.loading || own.refreshing || mutation.sessionChanged}
      refresh={() => {
        own.refresh();
        candidates.refresh();
        invitations.refresh();
      }}
    >
      {(coordinator, recovery) => {
        const disabled = baseDisabled || coordinator.locked;
        const searchDisabled =
          coordinator.locked ||
          mutation.busy ||
          mutation.sessionChanged ||
          candidates.loading ||
          candidates.refreshing;
        const proposal = coordinator.reviewing;
        return (
          <div className="work-invitations">
            <nav className="wsi-breadcrumb" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link href="/admin">Overview</Link>
                </li>
                <li>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span aria-current="page">Promotions & invitations</span>
                </li>
              </ol>
            </nav>
            <h1>Promotions & invitations</h1>
            <p className="wsi-intro">
              Promote a verified customer to branch staff, or invite an existing staff
              member to become an administrator.
            </p>
            <div className="wsi-links">
              <Link className="text-link" href="/admin/staff">
                Staff directory
              </Link>
              <Link className="text-link" href="/admin/audit">
                Access-change audit history
              </Link>
            </div>
            <Feedback message={message} tone="success" toast="Invitation updated." />
            {recovery}
            <div className="wsi-top">
              <section className="detail-section wsi-lookup">
                <h2>Find an existing account</h2>
                <p className="muted">Search using the account’s exact email address.</p>
                <form
                  data-draft-key="staff-invitation-form:1"
                  noValidate
                  onSubmit={search.handleSubmit((value) => {
                    if (searchDisabled) return;
                    setEmail(value.email.trim().toLowerCase());
                    candidates.refresh();
                    form.reset(defaults);
                    setMessage(undefined);
                    setPasswordShown(false);
                  })}
                >
                  <fieldset disabled={searchDisabled} className="wsi-search">
                    <div className="field">
                      <label htmlFor="team-email">Account email</label>
                      <input
                        id="team-email"
                        type="email"
                        autoComplete="off"
                        {...search.register("email")}
                        aria-invalid={!!search.formState.errors.email}
                        aria-describedby="team-email-error"
                      />
                      <p className="field-error" id="team-email-error">
                        {search.formState.errors.email?.message}
                      </p>
                    </div>
                    <button className="button">Search account</button>
                  </fieldset>
                </form>
                {email && candidates.loading && (
                  <p role="status">Checking eligible accounts…</p>
                )}
                <Feedback message={candidates.error || candidates.refreshError} />
                {candidates.refreshError && candidates.data && (
                  <p className="notice">
                    Previously loaded account details are shown. Refresh successfully
                    before making changes.
                  </p>
                )}
                {(candidates.error || candidates.refreshError) && (
                  <button className="button secondary" onClick={candidates.refresh}>
                    Retry account search
                  </button>
                )}
                {email &&
                  !candidates.loading &&
                  !candidates.error &&
                  candidates.data?.items.length === 0 && (
                    <p>
                      No active, verified customer or staff account matches this email.
                    </p>
                  )}
                {candidate && !candidates.error && !candidates.loading && (
                  <>
                    <div className="wsi-candidate">
                      <div>
                        <h3>
                          {[
                            candidate.profile?.firstName ??
                              candidate.staffProfile?.firstName,
                            candidate.profile?.lastName ??
                              candidate.staffProfile?.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || candidate.email}
                        </h3>
                        <p>{candidate.email}</p>
                      </div>
                      <div>
                        <span>Current role</span>
                        <strong>
                          {candidate.role === "CUSTOMER" ? "Customer" : "Staff"}
                        </strong>
                      </div>
                    </div>
                    <details className="wsi-reference">
                      <summary>Account reference</summary>
                      <p>{candidate.id}</p>
                    </details>
                    {candidate.staffProfile?.branch && (
                      <p className="muted">
                        Current branch: {candidate.staffProfile.branch.name}
                        {candidate.staffProfile.branch.isActive ? "" : " (inactive)"}
                      </p>
                    )}
                    {!candidate.management.canPromote &&
                      !candidate.management.canInvite && (
                        <p className="notice">
                          This account is not currently eligible for promotion or an
                          administrator invitation.
                        </p>
                      )}
                    {(candidate.management.canPromote ||
                      candidate.management.canInvite) && (
                      <form
                        data-draft-key="staff-invitation-form:2"
                        noValidate
                        onSubmit={form.handleSubmit((value) => {
                          if (disabled) return;
                          if (candidate.role === "CUSTOMER" && !value.branchId) {
                            form.setError(
                              "branchId",
                              { message: "Choose an active staff branch." },
                              { shouldFocus: true },
                            );
                            return;
                          }
                          form.setValue("currentPassword", "");
                          setPasswordShown(false);
                          coordinator.review(
                            {
                              title:
                                candidate.role === "CUSTOMER"
                                  ? "Promote this customer to staff?"
                                  : "Invite this staff member to ADMIN?",
                              description:
                                candidate.role === "CUSTOMER"
                                  ? "This grants branch operational access and revokes existing sessions. The account keeps its credentials and must complete MFA when signing in as staff."
                                  : "This queues a private invitation and replaces earlier unused invitations for this account. Administrator access is granted only after the intended staff member signs in, completes MFA and accepts. Queued email does not confirm delivery.",
                              facts: [
                                { label: "Account", value: candidate.email },
                                {
                                  label: "Access",
                                  value:
                                    candidate.role === "CUSTOMER"
                                      ? branchLabel
                                      : "Administrator across branches",
                                },
                              ],
                              retryAfterRejection: false,
                              submit: async () => {
                                if (candidate.role === "CUSTOMER") {
                                  const result = parseStaffMember(
                                    await submit("/admin/staff/promotions", {
                                      customerUserId: candidate.id,
                                      branchId: value.branchId,
                                      currentPassword: value.currentPassword,
                                    }),
                                  );
                                  if (
                                    result.id !== candidate.id ||
                                    result.email.toLowerCase() !==
                                      candidate.email.toLowerCase() ||
                                    result.role !== "STAFF" ||
                                    result.status !== "ACTIVE" ||
                                    !result.emailVerifiedAt ||
                                    result.staffProfile?.branchId !== value.branchId ||
                                    result.staffProfile?.branch?.id !== value.branchId ||
                                    !result.staffProfile?.branch?.isActive
                                  )
                                    throw new Error("Unexpected promotion result");
                                  setMessage(
                                    "Staff promotion recorded. Existing sessions were revoked.",
                                  );
                                } else {
                                  const result = parseQueuedInvitation(
                                    await submit("/admin/staff/invitations", {
                                      email: candidate.email,
                                      role: "ADMIN",
                                      currentPassword: value.currentPassword,
                                    }),
                                  );
                                  if (
                                    result.invitation.recipientId !== candidate.id ||
                                    result.invitation.email.toLowerCase() !==
                                      candidate.email.toLowerCase() ||
                                    result.invitation.invitedById !== session.user.id ||
                                    result.invitation.role !== "ADMIN" ||
                                    result.invitation.status !== "PENDING"
                                  )
                                    throw new Error("Unexpected invitation result");
                                  setMessage(
                                    "Administrator invitation queued. Email delivery and acceptance are not yet confirmed.",
                                  );
                                }
                                setEmail("");
                                invitations.refresh();
                              },
                            },
                            {
                              action:
                                candidate.role === "CUSTOMER"
                                  ? "promotion"
                                  : "invitation",
                              target: candidate.id,
                            },
                            async () => {
                              const latest = parseCandidates(
                                (
                                  await apiRequest(
                                    `/admin/staff/candidates?email=${encodeURIComponent(candidate.email)}`,
                                  )
                                ).data,
                                candidate.email,
                              ).items[0];
                              if (
                                !latest ||
                                JSON.stringify(latest) !== JSON.stringify(candidate)
                              )
                                throw new ApiError(409, {
                                  error: { code: "STALE_VERSION" },
                                });
                            },
                          );
                        })}
                      >
                        <fieldset disabled={disabled} className="wsi-proof">
                          {candidate.role === "CUSTOMER" && (
                            <div className="field">
                              <label htmlFor="team-branch">Active staff branch</label>
                              <Controller
                                name="branchId"
                                control={form.control}
                                render={({ field }) => (
                                  <AdminBranchPicker
                                    id="team-branch"
                                    value={field.value}
                                    inputRef={field.ref}
                                    error={form.formState.errors.branchId?.message}
                                    onChange={(id, label) => {
                                      field.onChange(id);
                                      setBranchLabel(label);
                                    }}
                                  />
                                )}
                              />
                            </div>
                          )}
                          <div className="field">
                            <label htmlFor="team-password">Your current password</label>
                            <div className="wsi-password">
                              <input
                                id="team-password"
                                type={passwordShown ? "text" : "password"}
                                autoComplete="current-password"
                                {...form.register("currentPassword")}
                                aria-invalid={!!form.formState.errors.currentPassword}
                                aria-describedby="team-password-error"
                              />
                              <button
                                type="button"
                                aria-label={
                                  passwordShown ? "Hide password" : "Show password"
                                }
                                title={passwordShown ? "Hide password" : "Show password"}
                                aria-pressed={passwordShown}
                                aria-controls="team-password"
                                onClick={() => setPasswordShown((v) => !v)}
                              >
                                {passwordShown ? (
                                  <EyeOff size={18} aria-hidden="true" />
                                ) : (
                                  <Eye size={18} aria-hidden="true" />
                                )}
                              </button>
                            </div>
                            <p className="field-error" id="team-password-error">
                              {form.formState.errors.currentPassword?.message}
                            </p>
                          </div>
                          <button className="button">
                            {candidate.role === "CUSTOMER"
                              ? "Review staff promotion"
                              : "Review administrator invitation"}
                          </button>
                        </fieldset>
                      </form>
                    )}
                  </>
                )}
              </section>
              <aside className="wsi-guidance">
                <details
                  open={guidanceOpen}
                  onToggle={(event) => setGuidanceOpen(event.currentTarget.open)}
                >
                  <summary>How access changes work</summary>
                  <h3>Customer to Staff</h3>
                  <p>
                    Choose an active branch for a verified customer. Promotion revokes
                    their existing sessions; staff sign-in requires MFA.
                  </p>
                  <h3>Staff to Admin</h3>
                  <p>
                    Administrator access starts only after the intended staff member signs
                    in, completes MFA and accepts the invitation.
                  </p>
                  <p className="notice">Queued email does not confirm delivery.</p>
                </details>
              </aside>
            </div>
            <section className="detail-section wsi-invitations">
              <div className="wsi-list-heading">
                <div>
                  <h2>Invitation status</h2>
                  <p>
                    {session?.user.role === "SUPER_ADMIN"
                      ? "All administrator invitations."
                      : "Invitations you created."}{" "}
                    Accepted, revoked and expired links cannot grant access.
                  </p>
                </div>
                <div className="wsi-toolbar">
                  <div className="field">
                    <label htmlFor="invitation-status">Invitation status filter</label>
                    <select
                      id="invitation-status"
                      value={status}
                      disabled={!!proposal}
                      onChange={(event) => {
                        const params = new URLSearchParams();
                        if (event.target.value) params.set("status", event.target.value);
                        navigate(params);
                      }}
                    >
                      <option value="">All statuses</option>
                      {["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"].map((value) => (
                        <option key={value} value={value}>
                          {value.charAt(0) + value.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="button secondary"
                    disabled={invitations.loading || !!proposal}
                    onClick={invitations.refresh}
                  >
                    Refresh invitations
                  </button>
                </div>
              </div>
              {view.invalid && (
                <div>
                  <Feedback message="This invitation view contains invalid or unsupported filters." />
                  <button
                    className="button secondary"
                    onClick={() => navigate(new URLSearchParams())}
                  >
                    Clear invitation filters
                  </button>
                </div>
              )}
              <Feedback message={invitations.error || invitations.refreshError} />
              {invitations.refreshError && invitations.data && (
                <p className="notice">
                  Previously loaded invitations are shown. Refresh successfully before
                  making changes.
                </p>
              )}
              {invitations.denied && (
                <p>
                  Invitation access is unavailable. Protected records have been cleared.
                </p>
              )}
              {invitations.data && !invitations.error && (
                <p className="wsi-count">{invitations.data.items.length} on this page</p>
              )}
              {invitations.loading && <p role="status">Checking invitations…</p>}
              {!invitations.loading &&
                !invitations.error &&
                invitations.data?.items.length === 0 && (
                  <p>No invitations match this view.</p>
                )}
              {!invitations.error &&
                !invitations.loading &&
                invitations.data?.items.map((item) => (
                  <article className="wsi-row" key={item.id}>
                    <div className="wsi-row-main">
                      <div className="wsi-recipient">
                        <h3>{item.email}</h3>
                        <p>
                          {item.role === "ADMIN" ? "Administrator" : "Staff"} invitation
                        </p>
                      </div>
                      <span
                        className={`wsi-status wsi-status-${item.status.toLowerCase()}`}
                        data-status={item.status}
                      >
                        {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                      </span>
                      <dl>
                        <div>
                          <dt>Created</dt>
                          <dd>{formatBusinessDate(item.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Expires</dt>
                          <dd>{formatBusinessDate(item.expiresAt)}</dd>
                        </div>
                      </dl>
                      <details className="wsi-record-details">
                        <summary>Invitation details</summary>
                        <dl>
                          <div>
                            <dt>Invitation reference</dt>
                            <dd>{item.id}</dd>
                          </div>
                          <div>
                            <dt>Recipient reference</dt>
                            <dd>{item.recipientId ?? "Not recorded"}</dd>
                          </div>
                          <div>
                            <dt>Invited by reference</dt>
                            <dd>{item.invitedById}</dd>
                          </div>
                          <div>
                            <dt>Accepted</dt>
                            <dd>
                              {item.usedAt
                                ? formatBusinessDate(item.usedAt)
                                : "Not accepted"}
                            </dd>
                          </div>
                          <div>
                            <dt>Revoked</dt>
                            <dd>
                              {item.revokedAt
                                ? formatBusinessDate(item.revokedAt)
                                : "Not revoked"}
                            </dd>
                          </div>
                        </dl>
                      </details>
                    </div>
                    {(item.status === "PENDING" || item.status === "EXPIRED") && (
                      <details className="wsi-revoke">
                        <summary>Revoke invitation</summary>
                        <p>
                          This disables the unused link. Existing account roles are
                          retained.
                        </p>
                        <RevokeInvitation
                          disabled={disabled}
                          email={item.email}
                          onReview={(password) =>
                            coordinator.review(
                              {
                                title: "Revoke this invitation?",
                                description:
                                  "The invitation link will no longer grant access. This does not change an existing account role.",
                                facts: [
                                  { label: "Recipient", value: item.email },
                                  {
                                    label: "Invitation role",
                                    value:
                                      item.role === "ADMIN" ? "Administrator" : "Staff",
                                  },
                                  {
                                    label: "Created",
                                    value: formatBusinessDate(item.createdAt),
                                  },
                                  {
                                    label: "Expires",
                                    value: formatBusinessDate(item.expiresAt),
                                  },
                                ],
                                retryAfterRejection: false,
                                submit: async () => {
                                  const result = invitationRecordSchema.parse(
                                    await submit(
                                      `/admin/staff/invitations/${item.id}/revoke`,
                                      {
                                        currentPassword: password,
                                      },
                                    ),
                                  );
                                  if (
                                    result.id !== item.id ||
                                    result.status !== "REVOKED" ||
                                    result.email !== item.email ||
                                    result.role !== item.role ||
                                    result.recipientId !== item.recipientId ||
                                    result.invitedById !== item.invitedById ||
                                    result.createdAt !== item.createdAt ||
                                    result.expiresAt !== item.expiresAt
                                  )
                                    throw new Error("Unexpected revocation result");
                                  setMessage("Invitation revoked.");
                                  invitations.refresh();
                                },
                              },
                              { action: "revocation", target: item.id },
                              async () => {
                                const latest = invitationRecordSchema.parse(
                                  (
                                    await apiRequest(
                                      `/admin/staff/invitations/${item.id}`,
                                    )
                                  ).data,
                                );
                                if (JSON.stringify(latest) !== JSON.stringify(item))
                                  throw new ApiError(409, {
                                    error: { code: "STALE_VERSION" },
                                  });
                              },
                            )
                          }
                        />
                      </details>
                    )}
                  </article>
                ))}
              {!view.invalid && (
                <nav className="pagination" aria-label="Invitations pages">
                  <button
                    className="button secondary"
                    disabled={
                      !view.params.has("cursor") ||
                      invitations.loading ||
                      invitations.refreshing ||
                      !!invitations.error ||
                      !!invitations.refreshError ||
                      !!proposal
                    }
                    onClick={() =>
                      navigate(invitationPageParams(view.params, undefined, true))
                    }
                  >
                    Previous
                  </button>
                  <span>
                    {view.params.has("_trail")
                      ? `Page ${view.params.get("_trail")!.split(",").length + 1}`
                      : view.params.has("cursor")
                        ? "Current page"
                        : "Page 1"}
                  </span>
                  <button
                    className="button secondary"
                    disabled={
                      !invitations.data?.nextCursor ||
                      invitations.loading ||
                      invitations.refreshing ||
                      !!invitations.error ||
                      !!invitations.refreshError ||
                      !!proposal
                    }
                    onClick={() =>
                      navigate(
                        invitationPageParams(view.params, invitations.data?.nextCursor),
                      )
                    }
                  >
                    Next
                  </button>
                </nav>
              )}
            </section>
          </div>
        );
      }}
    </InvitationChangeCoordinator>
  );
}

function RevokeInvitation({
  email,
  disabled,
  onReview,
}: {
  email: string;
  disabled: boolean;
  onReview: (password: string) => void;
}) {
  const inputId = useId();
  const [shown, setShown] = useState(false);
  const form = useForm({
    resolver: zodResolver(
      z.object({
        currentPassword: z.string().min(1, "Enter your current password.").max(128),
      }),
    ),
    defaultValues: { currentPassword: "" },
  });
  return (
    <form
      data-draft-key={JSON.stringify(["staff-invitation-form:3", email])}
      noValidate
      onSubmit={form.handleSubmit((value) => {
        onReview(value.currentPassword);
        form.reset();
        setShown(false);
      })}
    >
      <fieldset disabled={disabled}>
        <label htmlFor={inputId}>Your current password to revoke {email}</label>
        <div className="wsi-password">
          <input
            id={inputId}
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            {...form.register("currentPassword")}
            aria-invalid={!!form.formState.errors.currentPassword}
            aria-describedby={`${inputId}-error`}
          />
          <button
            type="button"
            aria-label={shown ? "Hide password" : "Show password"}
            title={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            aria-controls={inputId}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        {form.formState.errors.currentPassword && (
          <p role="alert" className="field-error" id={`${inputId}-error`}>
            {form.formState.errors.currentPassword.message}
          </p>
        )}
        <button className="button secondary">Review revocation</button>
      </fieldset>
    </form>
  );
}
