"use client";
import { useState } from "react";
import type { Ref } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffProfile, parseStaffProfiles } from "@/lib/api/staff-booking-schemas";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function StaffPicker({
  branchId,
  id,
  name = "staffId",
  initialId = "",
  onSelect,
  inputRef,
  error,
}: {
  branchId: string | null;
  id: string;
  name?: string;
  initialId?: string;
  onSelect?: (value: string) => void;
  inputRef?: Ref<HTMLSelectElement>;
  error?: string;
}) {
  const session = useAccountSession();
  const [selected, setSelected] = useState({
    id: initialId,
    label: "Current assignment",
  });
  const admin = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const pagination = useCursorPage();
  const own = useResource(!admin ? "/staff/profile" : null, parseStaffProfile);
  const staff = useResource(
    admin
      ? `/admin/staff?status=ACTIVE&limit=50${branchId ? `&branchId=${branchId}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseStaffProfiles,
  );
  const candidates = admin ? (staff.data?.items ?? []) : own.data ? [own.data] : [];
  const choices = candidates.flatMap((item) =>
    item.staffProfile &&
    item.status === "ACTIVE" &&
    (!branchId || item.staffProfile.branchId === branchId)
      ? [item.staffProfile]
      : [],
  );
  return (
    <>
      <select
        ref={inputRef}
        id={id}
        name={name}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        value={selected.id}
        onChange={(event) => {
          setSelected({
            id: event.target.value,
            label:
              event.target.selectedOptions[0]?.textContent ?? "Selected staff member",
          });
          onSelect?.(event.target.value);
        }}
      >
        <option value="">Choose a staff member</option>
        {selected.id && !choices.some((choice) => choice.id === selected.id) && (
          <option value={selected.id}>{selected.label}</option>
        )}
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.firstName} {choice.lastName}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      {!admin && (
        <p className="field-hint">
          You can choose your own branch profile. An administrator can assign another
          staff member.
        </p>
      )}
      {(own.loading || staff.loading) && <p role="status">Loading staff choices…</p>}
      <Feedback message={own.error ?? staff.error} />
      {(own.error || staff.error) && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            own.refresh();
            staff.refresh();
          }}
        >
          Retry staff choices
        </button>
      )}
      {admin && (staff.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={staff.data?.nextCursor}
          disabled={staff.loading || !!staff.error}
          label="Staff choices"
        />
      )}
    </>
  );
}
