"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { disputeProposal, type DisputeWork } from "@/lib/api/dispute-workflow";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
const operatorPage = z
  .object({
    items: z.array(z.object({ id: z.uuid(), label: z.string() }).strict()).max(25),
    nextCursor: z.uuid().nullable(),
  })
  .strict();
const parseOperators = (value: unknown) => operatorPage.parse(value);
export function DisputeAssignment({
  record,
  disabled,
  onReview,
  onDenied,
}: {
  record: DisputeWork;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onDenied?: () => void;
}) {
  const pagination = useCursorPage();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const accounts = useResource(
    `/staff/disputes/operators?limit=25${query ? `&q=${encodeURIComponent(query)}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseOperators,
  );
  useEffect(() => {
    if (accounts.denied) onDenied?.();
  }, [accounts.denied, onDenied]);
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
  const accountError = accounts.error || accounts.refreshError;
  const unavailable =
    accounts.loading || accounts.refreshing || !!accountError || query !== search.trim();
  const choices = accountError ? [] : (accounts.data?.items ?? []);
  return (
    <section className="detail-section aftercare-record">
      <h3>Primary and backup operators</h3>
      <p>
        Choose two different active accounts. Both must have verified email addresses and
        an active dispute-management grant; the server checks eligibility before saving.
      </p>
      <Feedback message={accountError} />
      {error && (
        <p id={`${record.id}-assignment-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${record.id}-operator-search`}>Find eligible operators</label>
        <input
          id={`${record.id}-operator-search`}
          type="search"
          maxLength={100}
          value={search}
          disabled={disabled}
          placeholder="Search name or email"
          onChange={(e) => {
            setSearch(e.target.value);
            pagination.reset();
          }}
        />
      </div>
      {accounts.loading && <p role="status">Checking eligible operators…</p>}
      {!unavailable && !choices.length && (
        <p role="status">
          No eligible operators match. Change the search or refresh the choices.
        </p>
      )}
      <form
        data-draft-key={JSON.stringify(["dispute-assignment:1", record?.id])}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || unavailable) return;
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
        <fieldset disabled={disabled || unavailable}>
          <legend>Dispute assignment</legend>
          {(["primary", "backup"] as const).map((kind) => (
            <div className="field" key={kind}>
              <label htmlFor={`${record.id}-${kind}`}>
                {kind === "primary" ? "Primary operator" : "Backup operator"}
              </label>
              <select
                id={`${record.id}-${kind}`}
                name={kind}
                aria-invalid={!!error}
                aria-describedby={error ? `${record.id}-assignment-error` : undefined}
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
                    {account.label}
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
      {(accounts.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={accounts.data?.nextCursor ?? undefined}
          disabled={disabled || unavailable}
          label="Dispute operator choices"
        />
      )}
    </section>
  );
}
