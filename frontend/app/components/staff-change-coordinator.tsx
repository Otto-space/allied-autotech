"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  parseOwnStaffProfile,
  parseCapabilityGrants,
} from "@/lib/api/capability-schemas";
import { parseWorkforceAccount } from "@/lib/api/workforce-schemas";
import { announceWorkforceRefresh } from "@/lib/workforce-invalidation";
import { staffRevision, type StaffMember } from "@/lib/api/staff-admin-schemas";
import { parseStaffDirectory } from "@/lib/admin/work-staff-directory";
import {
  clearStaffPending,
  markStaffPending,
  readStaffPending,
  type StaffChangePending,
  type StaffChangeArea,
} from "@/lib/admin/work-staff-pending";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type ChangeCoordinator = {
  locked: boolean;
  reviewing: boolean;
  pending: boolean;
  epoch: number;
  review: (
    proposal: MutationProposal,
    area: StaffChangeArea,
    onSuccess?: () => void,
    onClose?: () => void,
  ) => void;
};
const Context = createContext<ChangeCoordinator | null>(null);
export const useStaffChangeCoordinator = () => useContext(Context);

export function StaffChangeCoordinator({
  owner,
  role,
  member,
  workforceTarget,
  disabled,
  refresh,
  children,
}: {
  owner: string;
  role: string;
  member?: StaffMember;
  workforceTarget?: string;
  disabled: boolean;
  refresh: () => void;
  children: (coordinator: ChangeCoordinator, recovery: ReactNode) => ReactNode;
}) {
  const target = member?.id ?? workforceTarget,
    mounted = useRef(true),
    success = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false),
    [pending, setPending] = useState<StaffChangePending>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [callbacks, setCallbacks] = useState<{
    success?: () => void;
    close?: () => void;
  }>({});
  const [checking, setChecking] = useState(false),
    [inspected, setInspected] = useState(false),
    [acknowledged, setAcknowledged] = useState(false),
    [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>(),
    [epoch, setEpoch] = useState(0);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (mounted.current) {
        setPending(target ? readStaffPending(owner, role, target) : undefined);
        setReady(!!target);
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [owner, role, target]);
  const locked = disabled || !ready || !!pending || !!proposal || checking;
  async function currentAccount() {
    const actor = parseOwnStaffProfile((await apiRequest("/staff/profile")).data);
    if (actor.id !== owner || actor.role !== role || actor.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    if (!member && workforceTarget) {
      const latest = parseWorkforceAccount(
        (await apiRequest(`/admin/workforce/accounts/${workforceTarget}`)).data,
      );
      if (latest.userId !== workforceTarget)
        throw Error("Unexpected responsibility account");
      return null;
    }
    const latest = parseStaffDirectory(
      { items: [(await apiRequest(`/admin/staff/${target}`)).data] },
      new URLSearchParams(),
    ).items[0]!;
    if (latest.id !== target) throw Error("Unexpected account inspection");
    return staffRevision(latest);
  }
  function syncPending() {
    if (mounted.current && target) setPending(readStaffPending(owner, role, target));
  }
  function review(
    value: MutationProposal,
    area: StaffChangeArea,
    onSuccess?: () => void,
    onClose?: () => void,
  ) {
    if (locked || !target || (!member && area !== "workforce")) return;
    const revision = member ? staffRevision(member) : null;
    setMessage(undefined);
    setError(undefined);
    setInspected(false);
    setAcknowledged(false);
    setCallbacks({ success: onSuccess, close: onClose });
    setProposal({
      ...value,
      retryAfterRejection: false,
      submit: async () => {
        try {
          if ((await currentAccount()) !== revision)
            throw new ApiError(409, { error: { code: "STALE_VERSION" } });
        } catch (e) {
          refresh();
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
        let marker: Exclude<StaffChangePending, "unknown">;
        try {
          marker = markStaffPending(owner, role, target, area);
          syncPending();
        } catch {
          syncPending();
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
        try {
          await value.submit();
          clearStaffPending(owner, role, target, marker.token);
          syncPending();
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearStaffPending(owner, role, target, marker.token);
            syncPending();
          }
          throw e;
        }
      },
      onUncertain: () => {
        syncPending();
        value.onUncertain?.();
      },
    });
  }
  async function inspect() {
    if (!target || !pending || checking || proposal) return;
    setChecking(true);
    setError(undefined);
    setInspected(false);
    setAcknowledged(false);
    try {
      await currentAccount();
      const area = pending === "unknown" ? "unknown" : pending.area;
      if (role === "SUPER_ADMIN" && (area === "capability" || area === "unknown")) {
        for (const suffix of ["&activeOnly=true", ""]) {
          const grants = parseCapabilityGrants(
            (await apiRequest(`/admin/capabilities?userId=${target}${suffix}`)).data,
          );
          if (grants.some((v) => v.userId !== target || (suffix && v.revokedAt !== null)))
            throw Error("Unexpected permission inspection");
        }
      }
      if (area === "workforce" || (role === "SUPER_ADMIN" && area === "unknown")) {
        const workforce = parseWorkforceAccount(
          (await apiRequest(`/admin/workforce/accounts/${target}`)).data,
        );
        if (
          workforce.userId !== target ||
          (workforce.access && workforce.access.userId !== target) ||
          workforce.assignments.some((v) => v.userId !== target)
        )
          throw Error("Unexpected responsibility inspection");
      }
      if (mounted.current) {
        setInspected(true);
        refresh();
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof ApiError
            ? e.message
            : "Current access could not be checked. Keep this change locked and try again.",
        );
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  function reconcile() {
    if (
      !target ||
      !pending ||
      !inspected ||
      !acknowledged ||
      checking ||
      disabled ||
      proposal
    )
      return;
    try {
      clearStaffPending(
        owner,
        role,
        target,
        pending === "unknown" ? undefined : pending.token,
      );
      syncPending();
      setInspected(false);
      setAcknowledged(false);
      setEpoch((v) => v + 1);
      setMessage(
        "Reconciliation recorded on this device. Review current access before another change.",
      );
      refresh();
    } catch {
      setError(
        "The pending change could not be cleared safely. Keep it locked and try again.",
      );
    }
  }
  const coordinator = {
    locked,
    reviewing: !!proposal,
    pending: !!pending,
    epoch,
    review,
  };
  const recovery = (
    <>
      {message && (
        <p ref={success} className="notice" role="status" tabIndex={-1}>
          {message}
        </p>
      )}
      {pending && !proposal && (
        <section className="wsad-recovery" aria-labelledby="staff-recovery-title">
          <h2 id="staff-recovery-title">Check the previous access change</h2>
          <p>
            The result could not be confirmed. Changes remain locked after reload. No
            request will be resent automatically.
          </p>
          <p>
            Check current access and independently confirm the original action with its
            audit history or the responsible administrator. Matching current values alone
            do not prove that request completed.
          </p>
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
              <label className="wsad-ack">
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
    <Context.Provider value={coordinator}>
      {children(coordinator, recovery)}
      {proposal && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            callbacks.close?.();
            refresh();
          }}
          onSuccess={() => {
            announceWorkforceRefresh();
            callbacks.success?.();
            setMessage("Access change recorded. Current details are being refreshed.");
            requestAnimationFrame(() => success.current?.focus());
          }}
        />
      )}
    </Context.Provider>
  );
}
