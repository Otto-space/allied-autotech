"use client";
import { useCallback } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { parseSupportPage, type SupportKind } from "@/lib/api/support-schemas";
import { CursorPagination, useCursorPage } from "../cursor-pagination";

export type HandoffChoice = {
  id: string;
  label: string;
  version: number;
  branchId: string | null;
};
const branches = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
  nextCursor: z.uuid().optional(),
});
export function HandoffDestination({
  kind,
  value,
  disabled,
  onChange,
}: {
  kind: "branches" | SupportKind;
  value: HandoffChoice | null;
  disabled: boolean;
  onChange: (value: HandoffChoice | null) => void;
}) {
  const pagination = useCursorPage();
  const parse = useCallback(
    (raw: unknown) => {
      if (kind === "branches") {
        const parsed = branches.parse(raw);
        return {
          ...parsed,
          items: parsed.items.map((x) => ({
            id: x.id,
            label: x.name,
            version: 0,
            branchId: x.id,
            closed: false,
          })),
        };
      }
      const parsed = parseSupportPage(kind, false, raw);
      return {
        ...parsed,
        items: parsed.items.map((x) => ({
          id: x.id,
          label: x.subject,
          version: x.version,
          branchId: x.branchId,
          closed: x.status === "CLOSED",
        })),
      };
    },
    [kind],
  );
  const resource = useResource(
    `${kind === "branches" ? "/public/branches" : "/customers/support/" + kind}?limit=20${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  const loading = resource.loading || resource.refreshing;
  return (
    <fieldset className="handoff-destinations" disabled={disabled}>
      <legend>
        {kind === "branches" ? "Choose a branch" : `Choose one of your ${kind}`}
      </legend>
      {loading && <p role="status">Checking choices…</p>}
      {(resource.error || resource.refreshError) && (
        <div role="alert">
          <p>Choices could not be verified.</p>
          <button type="button" className="button secondary" onClick={resource.refresh}>
            Retry choices
          </button>
        </div>
      )}
      {!loading && !resource.error && !resource.refreshError && (
        <>
          {!resource.data?.items.length && (
            <p>
              No choices on this page.{" "}
              {kind !== "branches" && "You can start a new enquiry instead."}
            </p>
          )}
          {resource.data?.items.map((row) => (
            <label className="handoff-choice" key={row.id}>
              <input
                type="radio"
                name={`handoff-${kind}`}
                checked={value?.id === row.id}
                disabled={row.closed}
                onChange={() => onChange(row)}
              />
              <span>
                {row.label}
                {row.closed && <small>Closed · choose another request</small>}
              </span>
            </label>
          ))}
          {value && (
            <p className="handoff-selected">
              Selected: <strong>{value.label}</strong>{" "}
              <button
                type="button"
                className="learning-text-button"
                onClick={() => onChange(null)}
              >
                Clear selection
              </button>
            </p>
          )}
        </>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={resource.data?.nextCursor}
        disabled={disabled || loading || !!resource.error || !!resource.refreshError}
        label={kind === "branches" ? "Handoff branches" : `Your ${kind}`}
      />
    </fieldset>
  );
}
