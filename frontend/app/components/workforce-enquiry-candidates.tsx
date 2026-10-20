"use client";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  enquiryStaffName,
  parseWorkforceEnquiryCandidates,
  type WorkforceEnquiry,
  type WorkforceEnquiryCandidate,
} from "@/lib/admin/workforce-enquiries";
import { Feedback } from "./feedback";

export function EnquiryCandidates({
  row,
  selected,
  disabled,
  onSelect,
  invalid,
  errorId,
}: {
  row: WorkforceEnquiry;
  selected?: WorkforceEnquiryCandidate;
  disabled: boolean;
  onSelect: (value: WorkforceEnquiryCandidate) => void;
  invalid: boolean;
  errorId?: string;
}) {
  const [input, setInput] = useState(""),
    [q, setQ] = useState(""),
    [cursors, setCursors] = useState<string[]>([]),
    [error, setError] = useState<string>();
  const params = new URLSearchParams({ limit: "25" });
  if (q) params.set("q", q);
  if (cursors.length) params.set("cursor", cursors.at(-1)!);
  const result = useResource(
    `/staff/workforce/enquiries/${row.id}/assignees?${params}`,
    parseWorkforceEnquiryCandidates,
    undefined,
    { refreshKey: row.version },
  );
  const busy = result.loading || result.refreshing,
    failure = result.error || result.refreshError;
  const mismatch =
    !!result.data &&
    (result.data.enquiryId !== row.id ||
      result.data.enquiryVersion !== row.version ||
      result.data.branchId !== row.branchId ||
      !sameWorkforceScope(row.access, result.data.access));
  const data = !busy && !failure && !mismatch ? result.data : undefined;
  return (
    <div className="wfe-candidates">
      <form
        className="wfe-staff-search"
        aria-label="Search eligible staff"
        onSubmit={(e) => {
          e.preventDefault();
          const term = input.trim();
          if (
            term.length > 120 ||
            [...term].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
          ) {
            setError("Enter a name of up to 120 characters without control characters.");
            return;
          }
          setError(undefined);
          setQ(term);
          setCursors([]);
          if (q === term && !cursors.length) result.refresh();
        }}
      >
        <div className="field">
          <label htmlFor="wfe-staff-search">Search eligible staff</label>
          <input
            id="wfe-staff-search"
            type="search"
            maxLength={120}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="First or last name"
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? "wfe-staff-search-error" : undefined}
          />
        </div>
        <button className="button secondary" disabled={disabled || busy}>
          Search staff
        </button>
      </form>
      <div id="wfe-staff-search-error">
        <Feedback
          message={
            error ||
            failure ||
            (mismatch
              ? "Staff options changed. Refresh the enquiry before assigning."
              : undefined)
          }
        />
      </div>
      {failure && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled || busy}
          onClick={result.refresh}
        >
          Retry staff options
        </button>
      )}
      {busy && <p role="status">Checking eligible sales colleagues…</p>}
      <fieldset
        id="wfe-staff"
        className="wfe-staff-options"
        tabIndex={-1}
        disabled={disabled || !data}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      >
        <legend className="sr-only">Eligible sales colleagues</legend>
        {data && (
          <>
            <p role="status">{data.items.length} on this page</p>
            {data.items.length ? (
              data.items.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="radio"
                    name="wfe-staff-choice"
                    value={candidate.id}
                    checked={selected?.id === candidate.id}
                    onChange={() => onSelect(candidate)}
                  />
                  <span>
                    {enquiryStaffName(candidate)}
                    {candidate.id === row.assignedStaffId && <em> · Current assignee</em>}
                    <small>Staff reference: {candidate.id}</small>
                  </span>
                </label>
              ))
            ) : (
              <p>
                {q
                  ? "No eligible staff match this search."
                  : "No eligible sales colleagues are available in this branch."}
              </p>
            )}
          </>
        )}
      </fieldset>
      {data && (
        <nav className="wfe-paging" aria-label="Staff pages">
          <button
            type="button"
            className="button secondary"
            disabled={disabled || !cursors.length}
            onClick={() => setCursors([])}
          >
            First staff
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={disabled || !cursors.length}
            onClick={() => setCursors((old) => old.slice(0, -1))}
          >
            Previous staff
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={disabled || !data.nextCursor || cursors.includes(data.nextCursor)}
            onClick={() => {
              if (data.nextCursor) setCursors((old) => [...old, data.nextCursor!]);
            }}
          >
            Next staff
          </button>
        </nav>
      )}
      {selected && (
        <p className="wfe-selected-staff">
          Selected: <strong>{enquiryStaffName(selected)}</strong>
          <small>Staff reference: {selected.id}</small>Eligibility is checked again before
          assignment.
        </p>
      )}
    </div>
  );
}
