"use client";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffProfiles } from "@/lib/api/staff-booking-schemas";
import { disputeProposal, type DisputeWork } from "@/lib/api/dispute-workflow";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function DisputeAssignment({
  record,
  disabled,
  onReview,
}: {
  record: DisputeWork;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const pagination = useCursorPage();
  const accounts = useResource(
    `/admin/staff?status=ACTIVE&limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffProfiles,
  );
  const [selected, setSelected] = useState({
    primary: {
      id: record.primaryUserId ?? "",
      label: record.primaryOperator?.label ?? "Current primary",
    },
    backup: {
      id: record.backupUserId ?? "",
      label: record.backupOperator?.label ?? "Current backup",
    },
  });
  const [error, setError] = useState<string>();
  const choices = accounts.error
    ? []
    : (accounts.data?.items ?? []).filter(
        (account) =>
          account.status === "ACTIVE" &&
          ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(account.role),
      );
  return (
    <section className="detail-section aftercare-record">
      <h3>Primary and backup operators</h3>
      <p>
        Choose two different active accounts. Both must have verified email addresses and
        an active dispute-management grant; the server checks eligibility before saving.
      </p>
      <Feedback message={error ?? accounts.error} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || accounts.loading || accounts.error) return;
          if (
            !selected.primary.id ||
            !selected.backup.id ||
            selected.primary.id === selected.backup.id
          ) {
            setError("Choose two different operators.");
            return;
          }
          setError(undefined);
          onReview(
            disputeProposal(
              record,
              {
                action: "assign",
                body: {
                  primaryUserId: selected.primary.id,
                  backupUserId: selected.backup.id,
                },
              },
              {
                title: "Assign these dispute operators?",
                description:
                  "This changes who handles the dispute. It does not change the payment provider's deadline or financial outcome.",
                facts: [
                  { label: "Primary operator", value: selected.primary.label },
                  { label: "Backup operator", value: selected.backup.label },
                ],
              },
              (saved) =>
                saved.primaryUserId === selected.primary.id &&
                saved.backupUserId === selected.backup.id,
            ),
          );
        }}
      >
        <fieldset disabled={disabled || accounts.loading || !!accounts.error}>
          <legend>Dispute assignment</legend>
          {(["primary", "backup"] as const).map((kind) => (
            <div className="field" key={kind}>
              <label htmlFor={`${record.id}-${kind}`}>
                {kind === "primary" ? "Primary operator" : "Backup operator"}
              </label>
              <select
                id={`${record.id}-${kind}`}
                required
                value={selected[kind].id}
                onChange={(event) => {
                  const value = {
                    id: event.target.value,
                    label:
                      event.target.selectedOptions[0]?.textContent ?? "Selected operator",
                  };
                  setSelected((current) => ({ ...current, [kind]: value }));
                }}
              >
                <option value="">Choose an operator</option>
                {selected[kind].id &&
                  !choices.some((account) => account.id === selected[kind].id) && (
                    <option value={selected[kind].id}>{selected[kind].label}</option>
                  )}
                {choices.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.staffProfile
                      ? `${account.staffProfile.firstName} ${account.staffProfile.lastName}`
                      : account.email}{" "}
                    ({account.email})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button className="button secondary">Review dispute assignment</button>
        </fieldset>
      </form>
      <button
        className="text-link"
        disabled={disabled || accounts.loading}
        onClick={accounts.refresh}
      >
        Refresh operator choices
      </button>
      <CursorPagination
        pagination={pagination}
        nextCursor={accounts.data?.nextCursor}
        disabled={disabled || accounts.loading || !!accounts.error}
        label="Dispute operator choices"
      />
    </section>
  );
}
