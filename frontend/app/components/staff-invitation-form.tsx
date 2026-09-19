"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invitationSchema, type InvitationValues } from "@/lib/forms/staff-admin";
import { apiRequest } from "@/lib/api/client";
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
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

const searchSchema = z.object({
  email: z.email("Enter the account’s exact email address.").max(254),
});
const defaults: InvitationValues = { currentPassword: "", branchId: "" };
export function StaffInvitationForm() {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
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
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const candidates = useResource(
    allowed && email
      ? `/admin/staff/candidates?email=${encodeURIComponent(email)}`
      : null,
    parseCandidates,
  );
  const query = new URLSearchParams({ limit: "25" });
  if (status) query.set("status", status);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const invitations = useResource(
    allowed ? `/admin/staff/invitations?${query}` : null,
    parseInvitations,
  );
  const reset = useCallback(() => {
    form.reset(defaults);
    search.reset({ email: "" });
    setEmail("");
    setProposal(null);
    setMessage(undefined);
    setBranchLabel("");
  }, [form, search]);
  const mutation = useAccountMutation(reset);
  const candidate = candidates.data?.items[0];
  const disabled = !!proposal || mutation.busy || uncertain;
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
      mutation.finish(controller);
    }
  }
  if (!allowed)
    return (
      <>
        <h1>Team & access</h1>
        <Feedback message="Administrator access is required to manage team access." />
      </>
    );
  return (
    <>
      <h1>Team & access</h1>
      <p className="lead">
        Promote a verified customer to branch staff, or invite an existing staff member to
        become an administrator.
      </p>
      <div className="actions">
        <Link className="text-link" href="/admin/staff">
          Staff directory
        </Link>
        <Link className="text-link" href="/admin/audit">
          Access-change audit history
        </Link>
      </div>
      <Feedback message={message} tone="success" />
      {uncertain && (
        <p className="notice" role="status">
          The access change has an unknown outcome. Refresh invitation status or check the
          staff directory before starting another change. This page will not resend it.
        </p>
      )}
      <section className="detail-section">
        <h2>Find an existing account</h2>
        <form
          noValidate
          onSubmit={search.handleSubmit((value) => {
            if (disabled) return;
            setEmail(value.email.trim().toLowerCase());
            candidates.refresh();
            form.reset(defaults);
            setMessage(undefined);
          })}
        >
          <fieldset disabled={disabled}>
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
        {email && candidates.loading && <p role="status">Checking eligible accounts…</p>}
        <Feedback message={candidates.error} />
        {candidates.error && (
          <button className="button secondary" onClick={candidates.refresh}>
            Retry account search
          </button>
        )}
        {email &&
          !candidates.loading &&
          !candidates.error &&
          candidates.data?.items.length === 0 && (
            <p>No active, verified customer or staff account matches this email.</p>
          )}
        {candidate && !candidates.error && !candidates.loading && (
          <>
            <h3>{candidate.email}</h3>
            <p>
              Current role: {candidate.role} · Account reference: {candidate.id}
            </p>
            <form
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
                setProposal({
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
                  onUncertain: () => setUncertain(true),
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
                        result.role !== "STAFF" ||
                        result.staffProfile?.branchId !== value.branchId
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
                      if (result.invitation.recipientId !== candidate.id)
                        throw new Error("Unexpected invitation result");
                      setMessage(
                        "Administrator invitation queued. Email delivery and acceptance are not yet confirmed.",
                      );
                    }
                    setEmail("");
                    invitations.refresh();
                  },
                });
              })}
            >
              <fieldset disabled={disabled}>
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
                  <input
                    id="team-password"
                    type="password"
                    autoComplete="current-password"
                    {...form.register("currentPassword")}
                    aria-invalid={!!form.formState.errors.currentPassword}
                    aria-describedby="team-password-error"
                  />
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
          </>
        )}
      </section>
      <section className="detail-section">
        <h2>Invitation status</h2>
        <p>
          {session?.user.role === "SUPER_ADMIN"
            ? "All administrator invitations."
            : "Invitations you created."}{" "}
          Accepted, revoked and expired links cannot grant access.
        </p>
        <div className="field">
          <label htmlFor="invitation-status">Invitation status filter</label>
          <select
            id="invitation-status"
            value={status}
            disabled={!!proposal}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.reset();
            }}
          >
            <option value="">All statuses</option>
            {["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"].map((value) => (
              <option key={value}>{value}</option>
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
        <Feedback message={invitations.error} />
        {invitations.loading && <p role="status">Checking invitations…</p>}
        {!invitations.loading &&
          !invitations.error &&
          invitations.data?.items.length === 0 && <p>No invitations match this view.</p>}
        {!invitations.error &&
          !invitations.loading &&
          invitations.data?.items.map((item) => (
            <article className="list-item" key={item.id}>
              <div>
                <h3>{item.email}</h3>
                <p>
                  {item.role} · {item.status}
                </p>
                <p>Expires {formatBusinessDate(item.expiresAt)}</p>
                {(item.status === "PENDING" || item.status === "EXPIRED") && (
                  <RevokeInvitation
                    disabled={disabled}
                    email={item.email}
                    onReview={(password) =>
                      setProposal({
                        title: "Revoke this invitation?",
                        description:
                          "The invitation link will no longer grant access. This does not change an existing account role.",
                        facts: [{ label: "Recipient", value: item.email }],
                        retryAfterRejection: false,
                        onUncertain: () => setUncertain(true),
                        submit: async () => {
                          const result = invitationRecordSchema.parse(
                            await submit(`/admin/staff/invitations/${item.id}/revoke`, {
                              currentPassword: password,
                            }),
                          );
                          if (result.id !== item.id || result.status !== "REVOKED")
                            throw new Error("Unexpected revocation result");
                          setMessage("Invitation revoked.");
                          invitations.refresh();
                        },
                      })
                    }
                  />
                )}
              </div>
            </article>
          ))}
        <CursorPagination
          pagination={pagination}
          nextCursor={invitations.data?.nextCursor}
          disabled={invitations.loading || !!invitations.error || !!proposal}
          label="Invitations"
        />
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            form.setValue("currentPassword", "");
          }}
          onSuccess={() => {}}
        />
      )}
    </>
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
      noValidate
      onSubmit={form.handleSubmit((value) => {
        onReview(value.currentPassword);
        form.reset();
      })}
    >
      <fieldset disabled={disabled}>
        <label>
          Your current password to revoke {email}
          <input
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
            aria-invalid={!!form.formState.errors.currentPassword}
          />
        </label>
        {form.formState.errors.currentPassword && (
          <p role="alert" className="field-error">
            {form.formState.errors.currentPassword.message}
          </p>
        )}
        <button className="button secondary">Review revocation</button>
      </fieldset>
    </form>
  );
}
