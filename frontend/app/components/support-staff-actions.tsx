"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import {
  parseSupportRecord,
  priorities,
  supportActionSchema,
  supportTransitions,
  type SupportRecord,
} from "@/lib/api/support-schemas";
import { StaffPicker } from "./staff-picker";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { forgetThreadFormDraft } from "@/lib/admin/work-support-detail";
export function SupportStaffActions({
  record,
  base,
  disabled,
  onSaved,
  onUncertain,
  onReview,
}: {
  record: SupportRecord;
  base: string;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  onReview?: (proposal: MutationProposal) => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [version, setVersion] = useState(record.version);
  const changed = version !== record.version;
  const [assigneeLabel, setAssigneeLabel] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const form = useForm<z.infer<typeof supportActionSchema>>({
    resolver: zodResolver(supportActionSchema),
    defaultValues: {
      action: "status",
      selection: "",
      note: "",
      staffId: "",
      unassign: false,
    },
  });
  const action = useWatch({ control: form.control, name: "action" });
  const unassign = useWatch({ control: form.control, name: "unassign" });
  const options =
    action === "status"
      ? supportTransitions(record)
      : priorities.filter(
          (value) => record.kind !== "complaints" || value !== record.priority,
        );
  if (record.status === "CLOSED")
    return <p>Closed records cannot be reassigned, reprioritized or reopened here.</p>;
  function review(values: z.infer<typeof supportActionSchema>) {
    if (disabled || proposal || changed) return;
    const body = {
      expectedVersion: version,
      ...(values.action === "assignment"
        ? { assignedStaffId: values.unassign ? null : values.staffId }
        : values.action === "priority"
          ? { priority: values.selection }
          : {
              status: values.selection,
              ...(values.note
                ? record.kind === "enquiries"
                  ? { response: values.note }
                  : { resolution: values.note }
                : {}),
            }),
    };
    let savedVersion: number | undefined;
    (onReview ?? setProposal)({
      supportChange: { kind: values.action, expectedVersion: version, body },
      onConfirmed: () => {
        if (savedVersion !== undefined) {
          setVersion(savedVersion);
          form.reset({
            action: "status",
            selection: "",
            note: "",
            staffId: "",
            unassign: false,
          });
        }
      },
      title:
        values.action === "status"
          ? "Confirm this status change?"
          : values.action === "assignment"
            ? "Confirm this assignment change?"
            : "Confirm this priority change?",
      description:
        values.action === "status"
          ? "The status change and any resolution text produce one customer update. Do not send the same resolution again through Reply. Check Customer email delivery after saving. Closing prevents further replies from both customers and staff; no reopening action is available here."
          : "This updates the handling of the record. Branch and staff eligibility remain subject to the server's checks.",
      facts: [
        { label: "Subject", value: record.subject },
        { label: "Change", value: values.action },
        {
          label: "New value",
          value:
            values.action === "assignment"
              ? values.unassign
                ? "Unassigned"
                : assigneeLabel
              : values.selection.toLowerCase().replaceAll("_", " "),
        },
        ...(values.action === "status" && values.note
          ? [{ label: "Status update explanation", value: values.note }]
          : []),
      ],
      onUncertain,
      retryAfterRejection: false,
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const response = await apiRequest(`${base}/${values.action}`, {
            method: "POST",
            csrf: true,
            signal: controller.signal,
            body,
          });
          const saved = parseSupportRecord(record.kind, true, response.data);
          if (
            saved.id !== record.id ||
            saved.version !== version + 1 ||
            (values.action === "status" && saved.status !== values.selection) ||
            (values.action === "status" &&
              values.selection === "RESOLVED" &&
              saved.kind === "complaints" &&
              saved.resolution !== values.note) ||
            (values.action === "priority" &&
              (saved.kind !== "complaints" || saved.priority !== values.selection)) ||
            (values.action === "assignment" &&
              saved.assignedStaffId !== (values.unassign ? null : values.staffId))
          )
            throw new Error("Unconfirmed support change");
          savedVersion = saved.version;
          return response;
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <section className="detail-section" aria-labelledby="support-action-title">
      <h2 id="support-action-title">Manage this record</h2>
      <form
        data-draft-key={JSON.stringify(["support-staff-actions:1", record?.id, base])}
        noValidate
        onSubmit={(event) => void form.handleSubmit(review)(event)}
      >
        {changed && (
          <div className="notice">
            <p>
              This conversation changed. Your unsaved management fields are kept; reload
              them before reviewing another change.
            </p>
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={(event) => {
                forgetThreadFormDraft(event.currentTarget);
                setVersion(record.version);
                form.reset({
                  action: "status",
                  selection: "",
                  note: "",
                  staffId: "",
                  unassign: false,
                });
              }}
            >
              Reload management fields
            </button>
          </div>
        )}
        <fieldset disabled={disabled || changed}>
          <div className="field">
            <label htmlFor="support-action">Action</label>
            <select
              id="support-action"
              {...form.register("action", {
                onChange: () => {
                  form.setValue("selection", "");
                  form.clearErrors();
                },
              })}
            >
              <option value="status">Change status</option>
              <option value="assignment">Assign or unassign</option>
              {record.kind === "complaints" && (
                <option value="priority">Change priority</option>
              )}
            </select>
          </div>
          {action === "assignment" ? (
            <>
              <label className="check-label">
                <input type="checkbox" {...form.register("unassign")} />
                Remove the current assignment
              </label>
              {!unassign && (
                <div className="field">
                  <label htmlFor="support-assignee">Staff member</label>
                  <StaffPicker
                    key={record.id}
                    branchId={record.branchId}
                    id="support-assignee"
                    inputRef={form.register("staffId").ref}
                    onSelect={(value, label) => {
                      setAssigneeLabel(label);
                      form.setValue("staffId", value, { shouldValidate: true });
                    }}
                    error={form.formState.errors.staffId?.message}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="field">
              <label htmlFor="support-new-value">
                {action === "priority" ? "New priority" : "New status"}
              </label>
              <select
                id="support-new-value"
                {...form.register("selection")}
                aria-invalid={!!form.formState.errors.selection}
                aria-describedby="support-selection-error"
              >
                <option value="">Choose a new value</option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <p id="support-selection-error" className="field-error">
                {form.formState.errors.selection?.message}
              </p>
            </div>
          )}
          {action === "status" && (
            <div className="field">
              <label htmlFor="support-resolution">Status update explanation</label>
              <textarea
                id="support-resolution"
                maxLength={4000}
                rows={4}
                {...form.register("note")}
                aria-invalid={!!form.formState.errors.note}
                aria-describedby="support-resolution-error"
              />
              <p>
                Required when resolving. This explanation appears with the status update
                in the customer?s conversation.
              </p>
              <p id="support-resolution-error" className="field-error">
                {form.formState.errors.note?.message}
              </p>
            </div>
          )}
          <button type="submit" className="button">
            {action === "status"
              ? "Review status change"
              : action === "assignment"
                ? "Review assignment change"
                : "Review priority change"}
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel={`Confirm ${proposal.supportChange?.kind ?? "support"} change`}
          onClose={() => setProposal(null)}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
