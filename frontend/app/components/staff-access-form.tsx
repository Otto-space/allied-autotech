"use client";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  parseStaffMember,
  parseStaffStatus,
  parseStaffBranch,
  staffName,
  staffRevision,
  staffStatuses,
  type StaffMember,
} from "@/lib/api/staff-admin-schemas";
import { AdminBranchPicker } from "./admin-branch-picker";
import type { MutationProposal } from "./mutation-review";
async function recheckStaff(path: string, id: string, revision: string) {
  let latest: StaffMember;
  try {
    latest = parseStaffMember((await apiRequest<unknown>(path)).data);
    if (latest.id !== id) throw new Error("Unexpected account response");
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500)
      throw error;
    // A failed preflight read did not submit an access mutation.
    throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
  }
  if (staffRevision(latest) !== revision)
    throw new ApiError(409, { error: { code: "STALE_VERSION" } });
}
const schema = z
  .object({
    kind: z.enum(["status", "branch", "role"]),
    status: z.enum(["", ...staffStatuses]),
    role: z.literal("STAFF"),
    branchId: z.union([z.literal(""), z.uuid()]),
  })
  .superRefine((value, context) => {
    if (value.kind === "status" && !value.status)
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Choose the new account status.",
      });
    if (
      (value.kind === "branch" || (value.kind === "role" && value.role === "STAFF")) &&
      !value.branchId
    )
      context.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Choose an active branch.",
      });
  });
export function StaffAccessForm({
  member,
  superAdmin,
  disabled,
  uncertain,
  onReview,
}: {
  member: StaffMember;
  superAdmin: boolean;
  disabled: boolean;
  uncertain: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [draftRevision, setDraftRevision] = useState(staffRevision(member));
  const [branchLabel, setBranchLabel] = useState("");
  const defaults = {
    kind: "status" as const,
    status: "" as const,
    role: "STAFF" as const,
    branchId: "",
  };
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const role = useWatch({ control: form.control, name: "role" });
  const changed = staffRevision(member) !== draftRevision;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (disabled || uncertain || changed) return;
        const expected = staffRevision(member);
        const basePath = `/admin/staff/${member.id}`;
        if (
          value.kind === "status" &&
          (!value.status || value.status === member.status)
        ) {
          form.setError(
            "status",
            { message: "Choose a different status." },
            { shouldFocus: true },
          );
          return;
        }
        if (value.kind === "branch" && value.branchId === member.staffProfile?.branchId) {
          form.setError(
            "branchId",
            { message: "Choose a different branch." },
            { shouldFocus: true },
          );
          return;
        }
        const action = value.kind;
        onReview({
          title: `Review account ${action} change`,
          description: `This changes access for ${staffName(member)} and revokes their existing sessions. ${action === "status" && value.status !== "ACTIVE" ? "The account will no longer be able to sign in while this status applies." : action === "status" ? "The account can sign in again, subject to its security and branch requirements." : "Future sign-ins use the new branch scope. Existing booking assignments are not automatically reassigned by this action."}`,
          facts: [
            { label: "Account", value: member.email },
            { label: "User reference", value: member.id },
            {
              label: "Current role / status",
              value: `${member.role} / ${member.status}`,
            },
            {
              label: "Current branch",
              value: member.staffProfile?.branch?.name ?? "Not assigned",
            },
            {
              label: "Requested change",
              value:
                action === "status"
                  ? value.status
                  : action === "role"
                    ? value.role
                    : branchLabel,
            },
            ...(action === "branch" || (action === "role" && value.role === "STAFF")
              ? [{ label: "New branch", value: `${branchLabel} (${value.branchId})` }]
              : []),
          ],
          submit: async () => {
            await recheckStaff(basePath, member.id, expected);
            if (action === "status" && value.status) {
              const body: RequestBody<"/admin/staff/{staffUserId}/status", "patch"> = {
                status: value.status,
              };
              const result = parseStaffStatus(
                (
                  await apiRequest<unknown>(`${basePath}/status`, {
                    method: "PATCH",
                    csrf: true,
                    body,
                  })
                ).data,
              );
              if (result.id !== member.id || result.status !== body.status)
                throw new Error("Unexpected status response");
            } else if (action === "branch") {
              const body: RequestBody<"/admin/staff/{staffUserId}/branch", "patch"> = {
                branchId: value.branchId,
              };
              const result = parseStaffBranch(
                (
                  await apiRequest<unknown>(`${basePath}/branch`, {
                    method: "PATCH",
                    csrf: true,
                    body,
                  })
                ).data,
              );
              if (
                result.id !== member.staffProfile?.id ||
                result.branchId !== body.branchId
              )
                throw new Error("Unexpected branch response");
            } else if (action === "role" && superAdmin) {
              const body: RequestBody<"/admin/staff/{staffUserId}/role", "patch"> = {
                role: "STAFF",
                branchId: value.branchId,
              };
              const result = parseStaffMember(
                (
                  await apiRequest<unknown>(`${basePath}/role`, {
                    method: "PATCH",
                    csrf: true,
                    body,
                  })
                ).data,
              );
              if (
                result.id !== member.id ||
                result.role !== body.role ||
                result.staffProfile?.branchId !== body.branchId
              )
                throw new Error("Unexpected role response");
            } else throw new ApiError(403, { error: { code: "FORBIDDEN" } });
          },
        });
      })}
    >
      {uncertain && (
        <p className="notice" role="status">
          The previous change could not be confirmed. Refresh the account and reconcile
          its current access before making another change. This form will not resend the
          request.
        </p>
      )}
      {changed && !uncertain && (
        <div className="notice">
          <p>
            The account changed while you were editing. Review the current details and
            reload the action fields.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset(defaults);
              setBranchLabel("");
              setDraftRevision(staffRevision(member));
            }}
          >
            Reload account action
          </button>
        </div>
      )}
      <fieldset className="handover-fields" disabled={disabled || changed || uncertain}>
        <div className="field">
          <label htmlFor="staff-change-kind">Account change</label>
          <select id="staff-change-kind" {...form.register("kind")}>
            <option value="status">Account status</option>
            {member.role === "STAFF" && member.staffProfile && (
              <option value="branch">Branch assignment</option>
            )}
            {superAdmin && member.role === "ADMIN" && member.staffProfile && (
              <option value="role">Account role</option>
            )}
          </select>
        </div>
        {kind === "status" && (
          <div className="field">
            <label htmlFor="staff-new-status">New account status</label>
            <select
              id="staff-new-status"
              {...form.register("status")}
              aria-invalid={!!form.formState.errors.status}
              aria-describedby={
                form.formState.errors.status ? "staff-status-error" : undefined
              }
            >
              <option value="">Choose a status</option>
              {staffStatuses
                .filter((status) => status !== member.status)
                .map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
            </select>
            {form.formState.errors.status && (
              <p className="field-error" role="alert" id="staff-status-error">
                {form.formState.errors.status.message}
              </p>
            )}
          </div>
        )}
        {kind === "role" && (
          <div className="field">
            <label htmlFor="staff-new-role">New account role</label>
            <select id="staff-new-role" {...form.register("role")}>
              <option value="STAFF">STAFF</option>
            </select>
          </div>
        )}
        {(kind === "branch" || (kind === "role" && role === "STAFF")) && (
          <div className="field">
            <label htmlFor="staff-new-branch">New active branch</label>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <AdminBranchPicker
                  id="staff-new-branch"
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
        <button className="button secondary">Review account change</button>
      </fieldset>
    </form>
  );
}
