"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import {
  parseCandidates,
  parseInvitations,
  invitationRecordSchema,
} from "@/lib/api/team-access-schemas";
import { parseStaffMember } from "@/lib/api/staff-admin-schemas";
import {
  clearInvitationPending,
  markInvitationPending,
  readInvitationPending,
  type InvitationChange,
  type InvitationPending,
} from "@/lib/admin/work-invitation-pending";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export type InvitationCoordinator = {
  locked: boolean;
  reviewing: boolean;
  review: (
    proposal: MutationProposal,
    change: InvitationChange,
    preflight: () => Promise<void>,
  ) => void;
};
export function InvitationChangeCoordinator({
  owner,
  role,
  disabled,
  refresh,
  children,
}: {
  owner: string;
  role: string;
  disabled: boolean;
  refresh: () => void;
  children: (coordinator: InvitationCoordinator, recovery: ReactNode) => ReactNode;
}) {
  const mounted = useRef(true);
  const [ready, setReady] = useState(false),
    [pending, setPending] = useState<InvitationPending>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [checking, setChecking] = useState(false),
    [inspected, setInspected] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false),
    [email, setEmail] = useState("");
  const [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (mounted.current) {
        setPending(readInvitationPending(owner, role));
        setReady(true);
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [owner, role]);
  const sync = () => {
    if (mounted.current) setPending(readInvitationPending(owner, role));
  };
  async function actor() {
    const current = parseOwnStaffProfile((await apiRequest("/staff/profile")).data);
    if (current.id !== owner || current.role !== role || current.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  const locked = !ready || disabled || !!pending || !!proposal || checking;
  function review(
    value: MutationProposal,
    change: InvitationChange,
    preflight: () => Promise<void>,
  ) {
    if (locked) return;
    setMessage(undefined);
    setError(undefined);
    setInspected(false);
    setAcknowledged(false);
    setProposal({
      ...value,
      retryAfterRejection: false,
      submit: async () => {
        try {
          await actor();
          await preflight();
        } catch (e) {
          refresh();
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
        let marker: Exclude<InvitationPending, "unknown">;
        try {
          marker = markInvitationPending(owner, role, change);
          sync();
        } catch {
          sync();
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
        try {
          await value.submit();
          clearInvitationPending(owner, role, marker.token);
          sync();
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearInvitationPending(owner, role, marker.token);
            sync();
          }
          throw e;
        }
      },
      onUncertain: sync,
    });
  }
  async function inspect() {
    if (!pending || checking || proposal || disabled) return;
    setChecking(true);
    setError(undefined);
    setInspected(false);
    setAcknowledged(false);
    try {
      await actor();
      if (pending !== "unknown") {
        if (pending.action === "revocation") {
          const row = invitationRecordSchema.parse(
            (await apiRequest(`/admin/staff/invitations/${pending.target}`)).data,
          );
          if (
            row.id !== pending.target ||
            (role === "ADMIN" && row.invitedById !== owner)
          )
            throw Error("Invitation mismatch");
          setMessage(`Current invitation status: ${row.status.toLowerCase()}.`);
        } else {
          const exactEmail = z.email().parse(email.trim().toLowerCase());
          const found = parseCandidates(
            (
              await apiRequest(
                `/admin/staff/candidates?email=${encodeURIComponent(exactEmail)}`,
              )
            ).data,
            exactEmail,
          ).items[0];
          if (found) {
            if (found.id !== pending.target) throw Error("Account mismatch");
            setMessage(
              `Current account role: ${found.role === "STAFF" ? "Staff" : "Customer"}.`,
            );
          } else {
            const staff = parseStaffMember(
              (await apiRequest(`/admin/staff/${pending.target}`)).data,
            );
            if (staff.id !== pending.target || staff.email.toLowerCase() !== exactEmail)
              throw Error("Account mismatch");
            setMessage(
              `Current account role: ${staff.role === "ADMIN" ? "Admin" : staff.role === "STAFF" ? "Staff" : "Super Admin"}.`,
            );
          }
        }
      }
      parseInvitations(
        (await apiRequest("/admin/staff/invitations?limit=25")).data,
        new URLSearchParams(),
        { id: owner, role },
      );
      if (mounted.current) {
        setInspected(true);
        refresh();
      }
    } catch {
      if (mounted.current)
        setError(
          "Current access could not be confirmed. Check the account email and your permissions, then try again. Changes remain locked.",
        );
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  function reconcile() {
    if (!pending || !inspected || !acknowledged || disabled || checking || proposal)
      return;
    try {
      clearInvitationPending(
        owner,
        role,
        pending === "unknown" ? undefined : pending.token,
      );
      sync();
      setEmail("");
      setInspected(false);
      setAcknowledged(false);
      setMessage(
        "Reconciliation recorded on this device. Review current access before another change.",
      );
      refresh();
    } catch {
      setError("The pending change could not be cleared safely. Changes remain locked.");
    }
  }
  const recovery = (
    <>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {pending && !proposal && (
        <section className="wsi-recovery" aria-labelledby="invitation-recovery-title">
          <h2 id="invitation-recovery-title">Check the previous access change</h2>
          <p>
            The result could not be confirmed. Changes remain locked after reload. No
            request will be resent automatically.
          </p>
          <p>
            Check current access and independently confirm the original action in audit
            history or with the responsible administrator. Current values alone do not
            prove that request completed.
          </p>
          {pending === "unknown" && (
            <p>
              The original reference is unavailable on this device. Identify the affected
              account and action in audit history before completing reconciliation.
            </p>
          )}
          {pending !== "unknown" && pending.action !== "revocation" && (
            <div className="field">
              <label htmlFor="invitation-recovery-email">Affected account email</label>
              <input
                id="invitation-recovery-email"
                type="email"
                autoComplete="off"
                value={email}
                disabled={checking}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInspected(false);
                  setAcknowledged(false);
                }}
              />
            </div>
          )}
          <Feedback message={error} />
          <button
            className="button secondary"
            disabled={checking || disabled}
            onClick={() => void inspect()}
          >
            {checking ? "Checking current access…" : "Check current access"}
          </button>
          {inspected && (
            <div>
              <p role="status">
                Current access was checked. Complete the independent review before
                unlocking.
              </p>
              <label className="wsi-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                I independently reconciled the previous change and am ready to review a
                new action.
              </label>
              <button
                className="button secondary"
                disabled={!acknowledged || checking || disabled}
                onClick={reconcile}
              >
                Finish reconciliation
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
  return (
    <>
      {children({ locked, reviewing: !!proposal, review }, recovery)}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
